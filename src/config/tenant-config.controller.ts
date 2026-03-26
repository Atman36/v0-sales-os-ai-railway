import { BadRequestException, Body, Controller, Get, Post, Put, Query, UseGuards } from '@nestjs/common'
import { Throttle, ThrottlerGuard } from '@nestjs/throttler'
import { z } from 'zod'
import { CurrentAuthUser, requireRopAccess } from '../auth/access-control'
import { CurrentUser } from '../auth/current-user.decorator'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { AggregationService } from '../aggregation/aggregation.service'
import { TenantConfigService } from './tenant-config.service'
import { parseOrThrow } from '../utils/validation'
import { SINGLE_TENANT_GUARDRAILS, withSingleTenantGuardrails } from './single-tenant'

const updateSchema = z.object({
  timezone: z.string().optional(),
  webhookSecret: z.string().optional(),
  funnelStageMapping: z.record(z.string()).optional(),
  managerMapping: z.record(z.string()).optional(),
  planDefaults: z.record(z.number()).optional(),
})

const recomputeSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
})

const testWebhookSchema = z.object({
  secret: z.string().optional(),
})

@Controller()
export class TenantConfigController {
  constructor(
    private configService: TenantConfigService,
    private aggregationService: AggregationService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('config')
  async getConfig(@CurrentUser() user: CurrentAuthUser) {
    requireRopAccess(user)
    const config = await this.configService.getConfig()
    return withSingleTenantGuardrails(config)
  }

  @UseGuards(JwtAuthGuard)
  @Put('config')
  async updateConfig(@Body() body: unknown, @CurrentUser() user: CurrentAuthUser) {
    requireRopAccess(user)
    const payload = parseOrThrow(updateSchema, body)
    const config = await this.configService.updateConfig(payload)
    return withSingleTenantGuardrails(config)
  }

  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60 } })
  @Post('config/test-webhook')
  async testWebhook(@Body() body: unknown, @CurrentUser() user: CurrentAuthUser) {
    requireRopAccess(user)
    const payload = parseOrThrow(testWebhookSchema, body ?? {})
    const config = await this.configService.getConfig()

    const configuredSecret = (config.webhookSecret ?? '').trim()
    const providedSecret = (payload.secret ?? '').trim()

    const webhookSecretConfigured = Boolean(configuredSecret) && configuredSecret !== 'change-me'
    const providedSecretPresent = Boolean(providedSecret)
    const secretMatches = providedSecretPresent ? providedSecret === configuredSecret : null

    const ok = webhookSecretConfigured && providedSecretPresent && secretMatches === true

    const hints: string[] = []
    if (!webhookSecretConfigured) {
      hints.push('Set a non-default webhookSecret via PUT /config (avoid "change-me").')
    }
    if (!providedSecretPresent) {
      hints.push('Provide a secret to compare: POST /config/test-webhook { "secret": "..." }.')
    }
    if (providedSecretPresent && secretMatches === false) {
      hints.push('Provided secret does not match the configured webhookSecret.')
    }
    hints.push('Bitrix should call POST /webhooks/bitrix with header: x-salesos-secret=<your secret>.')

    return {
      ok,
      guardrails: SINGLE_TENANT_GUARDRAILS,
      checks: {
        webhookSecretConfigured,
        providedSecretPresent,
        secretMatches,
        rateLimit: { limit: 20, ttl: 60 },
      },
      hints,
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('recompute')
  async recompute(@Query() query: unknown, @CurrentUser() user: CurrentAuthUser) {
    requireRopAccess(user)
    const params = parseOrThrow(recomputeSchema, query)
    const from = params.from ? new Date(params.from) : new Date()
    const to = params.to ? new Date(params.to) : new Date()
    if (Number.isNaN(from.valueOf()) || Number.isNaN(to.valueOf())) {
      throw new BadRequestException('Invalid from/to dates')
    }
    return this.aggregationService.recomputeRange(from, to)
  }
}
