import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common'
import { z } from 'zod'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import { CurrentAuthUser, resolveInsightsScope } from '../auth/access-control'
import { AIInsightsService } from './ai.service'
import { parseOrThrow } from '../utils/validation'

const querySchema = z.object({
  scope: z.enum(['TEAM', 'MANAGER']).optional(),
  managerId: z.string().optional(),
})

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AIInsightsController {
  constructor(@Inject(AIInsightsService) private readonly aiService: AIInsightsService) {}

  @Get('insights')
  async listInsights(@Query() query: unknown, @CurrentUser() user: CurrentAuthUser) {
    const params = parseOrThrow(querySchema, query)
    const access = resolveInsightsScope(user, params.scope, params.managerId)
    return this.aiService.listInsights(access.scope, access.managerId)
  }
}
