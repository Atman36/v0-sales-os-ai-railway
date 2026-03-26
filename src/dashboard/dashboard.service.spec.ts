import { DashboardService } from './dashboard.service'

describe('DashboardService', () => {
  it('returns dashboard payload with totals, percent conversions, and ai tips', async () => {
    const prisma = {
      dailyMetrics: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            {
              date: new Date('2026-01-10T00:00:00.000Z'),
              callsTotal: 5,
              callsTarget: 3,
              dealsCount: 2,
              contractsCount: 1,
              invoicesCount: 1,
              invoicesAmount: 1000,
              paymentsCount: 1,
              margin: 200,
              avgCheck: 1000,
            },
          ])
          .mockResolvedValueOnce([
            {
              managerId: 'm1',
              date: new Date('2026-01-10T00:00:00.000Z'),
              callsTotal: 5,
              callsTarget: 3,
              dealsCount: 2,
              contractsCount: 1,
              invoicesCount: 1,
              invoicesAmount: 1000,
              paymentsCount: 1,
              margin: 200,
              avgCheck: 1000,
            },
          ]),
      },
      dealStageHistory: {
        groupBy: jest.fn().mockResolvedValue([{ stageKey: 'DEALS', _count: { stageKey: 2 } }]),
      },
      manager: {
        findMany: jest.fn().mockResolvedValue([{ id: 'm1', name: 'Alex', avatarUrl: null }]),
      },
      aIInsight: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'i1',
            scope: 'TEAM',
            type: 'RISK',
            title: 'Срыв оплат',
            summary: 'Оплаты отстают от плана.',
            why: 'Часть счетов зависла без follow-up.',
            recommendedActions: ['Позвонить клиентам со счетами старше 3 дней'],
            impactEstimate: 150000,
            confidence: 0.9,
            relatedManagerIds: ['m1'],
            relatedMetrics: ['payments_count'],
            managerId: null,
          },
        ]),
      },
    } as any

    const configService = {
      getConfig: jest.fn().mockResolvedValue({
        planDefaults: {
          margin_rub: 1000,
          calls_target: 3,
          deals_count: 2,
          payments_count: 1,
        },
      }),
    } as any

    const logger = {
      error: jest.fn(),
    } as any

    const service = new DashboardService(prisma, configService, logger)
    const result = await service.getDashboard(new Date('2026-01-01'), new Date('2026-01-31'))

    expect(result.totals.margin_rub.fact).toBe(200)
    expect(result.totals.cv_call_to_deal.fact).toBe(67)
    expect(result.funnel[0].stage).toBe('Сделки')
    expect(result.team[0].manager.name).toBe('Alex')
    expect(result.team[0].aiTip).toContain('Позвонить клиентам')
    expect(result.aiSummary?.title).toBe('Срыв оплат')
    expect(result.kpis.margin.fact).toBe(200)
    expect(result.aiInsights).toBeUndefined()
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('aggregates manager monthly plans for dashboard team metrics and falls back to tenant defaults', async () => {
    const prisma = {
      dailyMetrics: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            {
              date: new Date('2026-01-10T00:00:00.000Z'),
              callsTotal: 9,
              callsTarget: 5,
              dealsCount: 3,
              contractsCount: 2,
              invoicesCount: 1,
              invoicesAmount: 2000,
              paymentsCount: 1,
              margin: 400,
              avgCheck: 2000,
            },
          ])
          .mockResolvedValueOnce([
            {
              managerId: 'm1',
              date: new Date('2026-01-10T00:00:00.000Z'),
              callsTotal: 5,
              callsTarget: 3,
              dealsCount: 2,
              contractsCount: 1,
              invoicesCount: 1,
              invoicesAmount: 1000,
              paymentsCount: 1,
              margin: 250,
              avgCheck: 1000,
            },
            {
              managerId: 'm2',
              date: new Date('2026-01-11T00:00:00.000Z'),
              callsTotal: 4,
              callsTarget: 2,
              dealsCount: 1,
              contractsCount: 1,
              invoicesCount: 0,
              invoicesAmount: 0,
              paymentsCount: 0,
              margin: 150,
              avgCheck: 0,
            },
          ]),
      },
      managerMonthlyPlan: {
        findMany: jest.fn().mockResolvedValue([
          {
            managerId: 'm1',
            month: '2026-01',
            plan: {
              deals_count: 5,
              margin_rub: 1500,
            },
          },
        ]),
      },
      dealStageHistory: {
        groupBy: jest.fn().mockResolvedValue([{ stageKey: 'DEALS', _count: { stageKey: 3 } }]),
      },
      manager: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'm1', name: 'Alex', avatarUrl: null },
          { id: 'm2', name: 'Bella', avatarUrl: null },
        ]),
      },
      aIInsight: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as any

    const configService = {
      getConfig: jest.fn().mockResolvedValue({
        planDefaults: {
          margin_rub: 1000,
          deals_count: 2,
          calls_total: 20,
          calls_target: 10,
          payments_count: 1,
        },
      }),
    } as any

    const logger = {
      error: jest.fn(),
    } as any

    const service = new DashboardService(prisma, configService, logger)
    const result = await service.getDashboard(new Date('2026-01-01'), new Date('2026-01-31'))

    expect(prisma.managerMonthlyPlan.findMany).toHaveBeenCalledWith({
      where: {
        managerId: {
          in: ['m1', 'm2'],
        },
        month: '2026-01',
      },
    })

    expect(result.team[0].monthlyMetrics.margin_rub.plan).toBe(1500)
    expect(result.team[1].monthlyMetrics.margin_rub.plan).toBe(1000)
    expect(result.totals.margin_rub.plan).toBe(2500)
    expect(result.totals.deals_count.plan).toBe(7)
    expect(result.funnel[0].plan).toBe(7)
    expect(result.kpis.margin.plan).toBe(2500)
    expect(result.aiInsights).toBeUndefined()
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('keeps dashboard payload available and marks AI insights degraded when loading fails', async () => {
    const prisma = {
      dailyMetrics: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            {
              date: new Date('2026-01-10T00:00:00.000Z'),
              callsTotal: 5,
              callsTarget: 3,
              dealsCount: 2,
              contractsCount: 1,
              invoicesCount: 1,
              invoicesAmount: 1000,
              paymentsCount: 1,
              margin: 200,
              avgCheck: 1000,
            },
          ])
          .mockResolvedValueOnce([
            {
              managerId: 'm1',
              date: new Date('2026-01-10T00:00:00.000Z'),
              callsTotal: 5,
              callsTarget: 3,
              dealsCount: 2,
              contractsCount: 1,
              invoicesCount: 1,
              invoicesAmount: 1000,
              paymentsCount: 1,
              margin: 200,
              avgCheck: 1000,
            },
          ]),
      },
      dealStageHistory: {
        groupBy: jest.fn().mockResolvedValue([{ stageKey: 'DEALS', _count: { stageKey: 2 } }]),
      },
      manager: {
        findMany: jest.fn().mockResolvedValue([{ id: 'm1', name: 'Alex', avatarUrl: null }]),
      },
      aIInsight: {
        findMany: jest.fn().mockRejectedValue(new Error('AI storage unavailable')),
      },
    } as any

    const configService = {
      getConfig: jest.fn().mockResolvedValue({
        planDefaults: {
          margin_rub: 1000,
          calls_target: 3,
          deals_count: 2,
          payments_count: 1,
        },
      }),
    } as any

    const logger = {
      error: jest.fn(),
    } as any

    const service = new DashboardService(prisma, configService, logger)
    const result = await service.getDashboard(new Date('2026-01-01'), new Date('2026-01-31'))

    expect(result.team[0].aiTip).toBeUndefined()
    expect(result.aiSummary.title).toBe('Автоанализ воронки')
    expect(result.kpis.margin.fact).toBe(200)
    expect(result.aiInsights).toEqual({ degraded: true })
    expect(logger.error).toHaveBeenCalledWith({
      msg: 'Failed to load AI insights for dashboard response',
      scope: 'dashboard',
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-31T00:00:00.000Z',
      error: expect.any(Error),
    })
  })
})
