import { AIInsightsService } from './ai.service'

describe('AIInsightsService', () => {
  it('keeps managers pinned to their own related insights', async () => {
    const prisma = {
      aIInsight: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'team-manager-1',
            scope: 'TEAM',
            type: 'RISK',
            title: 'Team risk for manager 1',
            summary: 'Summary',
            why: 'Why',
            recommendedActions: ['Act'],
            promptVersion: 'v1',
            provider: 'stub',
            model: 'stub',
            impactEstimate: 1000,
            confidence: 0.9,
            relatedManagerIds: ['manager-1'],
            relatedMetrics: ['payments_count'],
            managerId: null,
            createdAt: new Date('2026-03-22T10:00:00.000Z'),
          },
          {
            id: 'team-manager-2',
            scope: 'TEAM',
            type: 'RISK',
            title: 'Team risk for manager 2',
            summary: 'Summary',
            why: 'Why',
            recommendedActions: ['Act'],
            promptVersion: 'v1',
            provider: 'stub',
            model: 'stub',
            impactEstimate: 1000,
            confidence: 0.9,
            relatedManagerIds: ['manager-2'],
            relatedMetrics: ['payments_count'],
            managerId: null,
            createdAt: new Date('2026-03-22T09:00:00.000Z'),
          },
          {
            id: 'manager-1-direct',
            scope: 'MANAGER',
            type: 'COACH',
            title: 'Coach note for manager 1',
            summary: 'Summary',
            why: 'Why',
            recommendedActions: ['Act'],
            promptVersion: 'v1',
            provider: 'stub',
            model: 'stub',
            impactEstimate: null,
            confidence: 0.8,
            relatedManagerIds: ['manager-1'],
            relatedMetrics: null,
            managerId: 'manager-1',
            createdAt: new Date('2026-03-22T08:00:00.000Z'),
          },
          {
            id: 'manager-2-direct',
            scope: 'MANAGER',
            type: 'COACH',
            title: 'Coach note for manager 2',
            summary: 'Summary',
            why: 'Why',
            recommendedActions: ['Act'],
            promptVersion: 'v1',
            provider: 'stub',
            model: 'stub',
            impactEstimate: null,
            confidence: 0.8,
            relatedManagerIds: ['manager-2'],
            relatedMetrics: null,
            managerId: 'manager-2',
            createdAt: new Date('2026-03-22T07:00:00.000Z'),
          },
        ]),
      },
    } as any

    const service = new AIInsightsService(prisma)
    const result = await service.listInsights('MANAGER', 'manager-1')

    expect(prisma.aIInsight.findMany).toHaveBeenCalledWith({
      where: {
        scope: { in: ['TEAM', 'MANAGER'] },
      },
      orderBy: { createdAt: 'desc' },
    })
    expect(result).toEqual({
      scope: 'MANAGER',
      insights: [
        expect.objectContaining({
          id: 'team-manager-1',
          scope: 'TEAM',
          related_manager_ids: ['manager-1'],
        }),
        expect.objectContaining({
          id: 'manager-1-direct',
          scope: 'MANAGER',
          managerId: 'manager-1',
        }),
      ],
    })
  })

  it('returns only team-scope insights for elevated team requests', async () => {
    const prisma = {
      aIInsight: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'team-1',
            scope: 'TEAM',
            type: 'RISK',
            title: 'Team risk',
            summary: 'Summary',
            why: 'Why',
            recommendedActions: ['Act'],
            promptVersion: 'v1',
            provider: 'stub',
            model: 'stub',
            impactEstimate: 1000,
            confidence: 0.9,
            relatedManagerIds: ['manager-1'],
            relatedMetrics: ['payments_count'],
            managerId: null,
            createdAt: new Date('2026-03-22T10:00:00.000Z'),
          },
        ]),
      },
    } as any

    const service = new AIInsightsService(prisma)
    const result = await service.listInsights('TEAM')

    expect(prisma.aIInsight.findMany).toHaveBeenCalledWith({
      where: {
        scope: 'TEAM',
      },
      orderBy: { createdAt: 'desc' },
    })
    expect(result).toEqual({
      scope: 'TEAM',
      insights: [
        expect.objectContaining({
          id: 'team-1',
          scope: 'TEAM',
        }),
      ],
    })
  })
})
