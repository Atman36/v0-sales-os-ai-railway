import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { isInsightRelatedToManager, normalizeInsightRecord } from './insights.utils'

@Injectable()
export class AIInsightsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listInsights(scope?: 'TEAM' | 'MANAGER', managerId?: string) {
    const where: any = {}
    if (scope === 'TEAM') {
      where.scope = 'TEAM'
    } else if (scope === 'MANAGER' && managerId) {
      where.scope = { in: ['TEAM', 'MANAGER'] }
    } else if (scope) {
      where.scope = scope
    }

    const insights = await this.prisma.aIInsight.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    const normalizedInsights = insights.map((insight) => normalizeInsightRecord(insight))
    const filteredInsights =
      scope === 'MANAGER' && managerId
        ? normalizedInsights.filter((insight) => isInsightRelatedToManager(insight, managerId))
        : normalizedInsights

    return {
      scope,
      insights: filteredInsights,
    }
  }
}
