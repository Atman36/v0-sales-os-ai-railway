import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Prisma } from '@prisma/client'
import { DEFAULT_INSECURE_SECRET, isDefaultSecret, isSafeEnv, normalizeSecret } from '@shared/runtime-env'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class TenantConfigService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly env: ConfigService,
  ) {}

  async getConfig() {
    this.getRuntimeWebhookSecret()
    const existing = await this.loadSingleConfigRecord()
    if (existing) return this.validateStoredConfig(existing)

    const created = await this.prisma.tenantConfig.create({
      data: this.buildDefaults(),
    })
    return this.validateStoredConfig(created)
  }

  async updateConfig(payload: Prisma.TenantConfigUpdateInput) {
    this.getRuntimeWebhookSecret()
    const existing = await this.loadSingleConfigRecord()
    if (!existing) {
      const created = await this.prisma.tenantConfig.create({
        data: {
          ...this.buildDefaults(),
          ...payload,
        } as Prisma.TenantConfigCreateInput,
      })
      return this.validateStoredConfig(created)
    }
    const updated = await this.prisma.tenantConfig.update({
      where: { id: existing.id },
      data: payload,
    })
    return this.validateStoredConfig(updated)
  }

  private buildDefaults() {
    return {
      timezone: this.env.get<string>('TENANT_TIMEZONE') ?? 'UTC',
      webhookSecret: this.getRuntimeWebhookSecret(),
      funnelStageMapping: {},
      managerMapping: {},
      planDefaults: {},
    }
  }

  private async loadSingleConfigRecord() {
    const configs = await this.prisma.tenantConfig.findMany({
      orderBy: { createdAt: 'asc' },
      take: 2,
    })

    if (configs.length > 1) {
      throw new InternalServerErrorException(
        'Sales OS is running in single-tenant mode and expects exactly one shared company config record.',
      )
    }

    return configs[0] ?? null
  }

  private getRuntimeWebhookSecret() {
    const secret = normalizeSecret(this.env.get<string>('SALESOS_WEBHOOK_SECRET'))
    if (secret) {
      if (!isSafeEnv(this.env.get<string>('NODE_ENV')) && isDefaultSecret(secret)) {
        throw new InternalServerErrorException(
          'SALESOS_WEBHOOK_SECRET must be changed outside development/test.',
        )
      }
      return secret
    }

    if (isSafeEnv(this.env.get<string>('NODE_ENV'))) {
      return DEFAULT_INSECURE_SECRET
    }

    throw new InternalServerErrorException(
      'SALESOS_WEBHOOK_SECRET is required outside development/test.',
    )
  }

  private validateStoredConfig<T extends { webhookSecret: string }>(config: T): T {
    const secret = normalizeSecret(config.webhookSecret)
    if (isSafeEnv(this.env.get<string>('NODE_ENV'))) {
      return config
    }

    if (!secret) {
      throw new InternalServerErrorException(
        'Persisted TenantConfig.webhookSecret is empty. Set a non-default SALESOS_WEBHOOK_SECRET before starting deployment envs.',
      )
    }

    if (isDefaultSecret(secret)) {
      throw new InternalServerErrorException(
        'Persisted TenantConfig.webhookSecret uses the default placeholder. Set a non-default SALESOS_WEBHOOK_SECRET before starting deployment envs.',
      )
    }

    return config
  }
}
