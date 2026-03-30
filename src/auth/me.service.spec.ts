import { NotFoundException } from '@nestjs/common'
import { MeService } from './me.service'

describe('MeService', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-20T10:00:00.000Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('builds /me/summary from current manager metrics, reports, and effective plan defaults', async () => {
    const prisma = {
      manager: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'manager-1',
          name: 'Alice',
          avatarUrl: 'https://example.com/a.png',
        }),
      },
      dailyMetrics: {
        findMany: jest.fn().mockResolvedValue([
          {
            date: new Date('2026-03-18T00:00:00.000Z'),
            callsTotal: 5,
            callsTarget: 3,
            dealsCount: 1,
            contractsCount: 1,
            invoicesCount: 1,
            invoicesAmount: 50000,
            paymentsCount: 1,
            margin: 15000,
            avgCheck: 50000,
          },
          {
            date: new Date('2026-03-20T00:00:00.000Z'),
            callsTotal: 10,
            callsTarget: 6,
            dealsCount: 2,
            contractsCount: 1,
            invoicesCount: 2,
            invoicesAmount: 100000,
            paymentsCount: 1,
            margin: 35000,
            avgCheck: 50000,
          },
        ]),
      },
      dailyReport: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'report-20',
            managerId: 'manager-1',
            date: new Date('2026-03-20T00:00:00.000Z'),
            callsTotal: 10,
            callsTarget: 6,
            dealsCount: 2,
            contractsCount: 1,
            invoicesCount: 2,
            invoicesAmount: 100000,
            paymentsCount: 1,
            margin: 35000,
            comment: 'strong day',
            submittedAt: new Date('2026-03-20T10:00:00.000Z'),
            updatedAt: new Date('2026-03-20T10:00:00.000Z'),
          },
          {
            id: 'report-18',
            managerId: 'manager-1',
            date: new Date('2026-03-18T00:00:00.000Z'),
            callsTotal: 5,
            callsTarget: 3,
            dealsCount: 1,
            contractsCount: 1,
            invoicesCount: 1,
            invoicesAmount: 50000,
            paymentsCount: 1,
            margin: 15000,
            comment: '',
            submittedAt: new Date('2026-03-18T18:00:00.000Z'),
            updatedAt: new Date('2026-03-18T18:00:00.000Z'),
          },
        ]),
      },
    } as any

    const configService = {
      getConfig: jest.fn().mockResolvedValue({
        timezone: 'Asia/Yekaterinburg',
        planDefaults: {
          calls_total: 40,
          deals_count: 8,
          contracts_count: 4,
          invoices_count: 4,
          payments_count: 3,
          invoices_amount_rub: 200000,
          avg_check_rub: 50000,
          margin: 120000,
        },
      }),
    } as any

    const service = new MeService(prisma, configService)
    const result = await service.getSummary('manager-1')

    expect(prisma.dailyMetrics.findMany).toHaveBeenCalledWith({
      where: {
        managerId: 'manager-1',
        scope: 'MANAGER',
        date: {
          gte: new Date('2026-03-01T00:00:00.000Z'),
          lte: new Date('2026-03-31T00:00:00.000Z'),
        },
      },
      orderBy: {
        date: 'asc',
      },
    })

    expect(prisma.dailyReport.findMany).toHaveBeenCalledWith({
      where: {
        managerId: 'manager-1',
        date: {
          gte: new Date('2026-03-14T00:00:00.000Z'),
          lte: new Date('2026-03-20T00:00:00.000Z'),
        },
      },
      orderBy: {
        date: 'desc',
      },
    })

    expect(result).toMatchObject({
      manager: {
        id: 'manager-1',
        name: 'Alice',
        avatarUrl: 'https://example.com/a.png',
      },
      month: {
        value: '2026-03',
        from: '2026-03-01',
        to: '2026-03-31',
      },
      monthMetrics: {
        calls_total: { plan: 40, fact: 15 },
        deals_count: { plan: 8, fact: 3 },
        contracts_count: { plan: 4, fact: 2 },
        invoices_count: { plan: 4, fact: 3 },
        payments_count: { plan: 3, fact: 2 },
        invoices_amount_rub: { plan: 200000, fact: 150000 },
        margin_rub: { plan: 120000, fact: 50000 },
        avg_check_rub: { plan: 50000, fact: 50000 },
      },
      todayMetrics: {
        date: '2026-03-20',
        day: 20,
        calls_total: 10,
        margin_rub: 35000,
      },
      todayReport: {
        id: 'report-20',
        date: '2026-03-20',
        comment: 'strong day',
      },
      plan: {
        margin_rub: 120000,
        calls_total: 40,
      },
      timezone: 'Asia/Yekaterinburg',
    })

    expect(result.recentReports).toHaveLength(2)
  })

  it('falls back to UTC timezone in /me/summary when tenant config does not define one', async () => {
    const prisma = {
      manager: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'manager-1',
          name: 'Alice',
          avatarUrl: null,
        }),
      },
      dailyMetrics: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      dailyReport: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as any

    const configService = {
      getConfig: jest.fn().mockResolvedValue({
        planDefaults: {},
      }),
    } as any

    const service = new MeService(prisma, configService)
    const result = await service.getSummary('manager-1')

    expect(result.timezone).toBe('UTC')
  })

  it('builds /me/plan for a requested month and returns month daily metrics with today report when it matches the month', async () => {
    const prisma = {
      manager: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'manager-1',
          name: 'Alice',
          avatarUrl: null,
        }),
      },
      dailyMetrics: {
        findMany: jest.fn().mockResolvedValue([
          {
            date: new Date('2026-03-01T00:00:00.000Z'),
            callsTotal: 4,
            callsTarget: 2,
            dealsCount: 1,
            contractsCount: 0,
            invoicesCount: 0,
            invoicesAmount: 0,
            paymentsCount: 0,
            margin: 0,
            avgCheck: 0,
          },
          {
            date: new Date('2026-03-20T00:00:00.000Z'),
            callsTotal: 9,
            callsTarget: 5,
            dealsCount: 2,
            contractsCount: 1,
            invoicesCount: 1,
            invoicesAmount: 75000,
            paymentsCount: 1,
            margin: 20000,
            avgCheck: 75000,
          },
        ]),
      },
      dailyReport: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'report-20',
          managerId: 'manager-1',
          date: new Date('2026-03-20T00:00:00.000Z'),
          callsTotal: 9,
          callsTarget: 5,
          dealsCount: 2,
          contractsCount: 1,
          invoicesCount: 1,
          invoicesAmount: 75000,
          paymentsCount: 1,
          margin: 20000,
          comment: 'done',
          submittedAt: new Date('2026-03-20T10:00:00.000Z'),
          updatedAt: new Date('2026-03-20T10:00:00.000Z'),
        }),
      },
    } as any

    const configService = {
      getConfig: jest.fn().mockResolvedValue({
        planDefaults: {
          calls_total: 60,
          calls_target: 30,
          deals_count: 12,
          contracts_count: 6,
          invoices_count: 6,
          payments_count: 4,
          margin_rub: 180000,
        },
      }),
    } as any

    const service = new MeService(prisma, configService)
    const result = await service.getPlan('manager-1', '2026-03')

    expect(prisma.dailyReport.findUnique).toHaveBeenCalledWith({
      where: {
        managerId_date: {
          managerId: 'manager-1',
          date: new Date('2026-03-20T00:00:00.000Z'),
        },
      },
    })

    expect(result).toMatchObject({
      month: {
        value: '2026-03',
        from: '2026-03-01',
        to: '2026-03-31',
      },
      monthMetrics: {
        calls_total: { plan: 60, fact: 13 },
        calls_target: { plan: 30, fact: 7 },
        deals_count: { plan: 12, fact: 3 },
        margin_rub: { plan: 180000, fact: 20000 },
      },
      dailyMetrics: [
        { date: '2026-03-01', day: 1, calls_total: 4 },
        { date: '2026-03-20', day: 20, calls_total: 9 },
      ],
      todayReport: {
        id: 'report-20',
        date: '2026-03-20',
      },
      plan: {
        margin_rub: 180000,
      },
    })
  })

  it('prefers manager monthly plan and falls back to tenant defaults for missing keys', async () => {
    const prisma = {
      manager: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'manager-1',
          name: 'Alice',
          avatarUrl: null,
        }),
      },
      managerMonthlyPlan: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'plan-1',
          managerId: 'manager-1',
          month: '2026-03',
          plan: {
            calls_total: 80,
            margin_rub: 240000,
          },
        }),
      },
      dailyMetrics: {
        findMany: jest.fn().mockResolvedValue([
          {
            date: new Date('2026-03-10T00:00:00.000Z'),
            callsTotal: 12,
            callsTarget: 6,
            dealsCount: 2,
            contractsCount: 1,
            invoicesCount: 1,
            invoicesAmount: 90000,
            paymentsCount: 1,
            margin: 30000,
            avgCheck: 90000,
          },
        ]),
      },
      dailyReport: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    } as any

    const configService = {
      getConfig: jest.fn().mockResolvedValue({
        planDefaults: {
          calls_total: 60,
          deals_count: 12,
          contracts_count: 6,
          invoices_count: 5,
          payments_count: 4,
          margin_rub: 180000,
        },
      }),
    } as any

    const service = new MeService(prisma, configService)
    const result = await service.getPlan('manager-1', '2026-03')

    expect(prisma.managerMonthlyPlan.findUnique).toHaveBeenCalledWith({
      where: {
        managerId_month: {
          managerId: 'manager-1',
          month: '2026-03',
        },
      },
    })

    expect(result.plan).toMatchObject({
      calls_total: 80,
      deals_count: 12,
      margin_rub: 240000,
    })
    expect(result.monthMetrics.calls_total.plan).toBe(80)
    expect(result.monthMetrics.margin_rub.plan).toBe(240000)
    expect(result.monthMetrics.deals_count.plan).toBe(12)
  })

  it('throws when manager binding points to a missing manager', async () => {
    const prisma = {
      manager: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    } as any

    const configService = {
      getConfig: jest.fn(),
    } as any

    const service = new MeService(prisma, configService)

    await expect(service.getSummary('missing-manager')).rejects.toThrow(NotFoundException)
  })
})
