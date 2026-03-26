import { NotFoundException } from '@nestjs/common'
import { ReportsService } from './reports.service'

describe('ReportsService', () => {
  const originalSourceOfTruth = process.env.DAILY_METRICS_SOURCE_OF_TRUTH

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-19T12:34:56.000Z'))
    process.env.DAILY_METRICS_SOURCE_OF_TRUTH = 'manual_reports'
  })

  afterEach(() => {
    jest.useRealTimers()
    if (originalSourceOfTruth === undefined) {
      delete process.env.DAILY_METRICS_SOURCE_OF_TRUTH
    } else {
      process.env.DAILY_METRICS_SOURCE_OF_TRUTH = originalSourceOfTruth
    }
  })

  it('upserts a manager report by managerId and date', async () => {
    const prisma = {
      dailyReport: {
        upsert: jest.fn().mockResolvedValue({
          id: 'report-1',
          managerId: 'manager-1',
          date: new Date('2026-03-19T00:00:00.000Z'),
          callsTotal: 12,
          callsTarget: 7,
          dealsCount: 3,
          contractsCount: 2,
          invoicesCount: 2,
          invoicesAmount: 150000,
          paymentsCount: 1,
          margin: 45000,
          comment: 'Closed strong',
          submittedAt: new Date('2026-03-19T12:34:56.000Z'),
          updatedAt: new Date('2026-03-19T12:34:56.000Z'),
        }),
      },
      dailyMetrics: {
        upsert: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([
          {
            callsTotal: 12,
            callsTarget: 7,
            dealsCount: 3,
            contractsCount: 2,
            invoicesCount: 2,
            invoicesAmount: 150000,
            paymentsCount: 1,
            margin: 45000,
          },
        ]),
      },
    } as any

    const service = new ReportsService(prisma)
    const payload = {
      calls_total: 12,
      calls_target: 7,
      deals_count: 3,
      contracts_count: 2,
      invoices_count: 2,
      invoices_amount_rub: 150000,
      payments_count: 1,
      margin_rub: 45000,
      comment: 'Closed strong',
    }

    const result = await service.upsertMyReport('manager-1', '2026-03-19', payload)

    expect(prisma.dailyReport.upsert).toHaveBeenCalledWith({
      where: {
        managerId_date: {
          managerId: 'manager-1',
          date: new Date('2026-03-19T00:00:00.000Z'),
        },
      },
      update: {
        callsTotal: 12,
        callsTarget: 7,
        dealsCount: 3,
        contractsCount: 2,
        invoicesCount: 2,
        invoicesAmount: 150000,
        paymentsCount: 1,
        margin: 45000,
        comment: 'Closed strong',
        submittedAt: new Date('2026-03-19T12:34:56.000Z'),
      },
      create: {
        managerId: 'manager-1',
        date: new Date('2026-03-19T00:00:00.000Z'),
        callsTotal: 12,
        callsTarget: 7,
        dealsCount: 3,
        contractsCount: 2,
        invoicesCount: 2,
        invoicesAmount: 150000,
        paymentsCount: 1,
        margin: 45000,
        comment: 'Closed strong',
        submittedAt: new Date('2026-03-19T12:34:56.000Z'),
      },
    })

    expect(prisma.dailyMetrics.upsert).toHaveBeenNthCalledWith(1, {
      where: {
        date_managerKey: {
          date: new Date('2026-03-19T00:00:00.000Z'),
          managerKey: 'manager-1',
        },
      },
      update: {
        callsTotal: 12,
        callsTarget: 7,
        dealsCount: 3,
        contractsCount: 2,
        invoicesCount: 2,
        invoicesAmount: 150000,
        paymentsCount: 1,
        margin: 45000,
        avgCheck: 75000,
      },
      create: {
        date: new Date('2026-03-19T00:00:00.000Z'),
        scope: 'MANAGER',
        managerKey: 'manager-1',
        managerId: 'manager-1',
        callsTotal: 12,
        callsTarget: 7,
        dealsCount: 3,
        contractsCount: 2,
        invoicesCount: 2,
        invoicesAmount: 150000,
        paymentsCount: 1,
        margin: 45000,
        avgCheck: 75000,
      },
    })

    expect(prisma.dailyMetrics.findMany).toHaveBeenCalledWith({
      where: {
        date: new Date('2026-03-19T00:00:00.000Z'),
        scope: 'MANAGER',
      },
    })

    expect(prisma.dailyMetrics.upsert).toHaveBeenNthCalledWith(2, {
      where: {
        date_managerKey: {
          date: new Date('2026-03-19T00:00:00.000Z'),
          managerKey: 'team',
        },
      },
      update: {
        callsTotal: 12,
        callsTarget: 7,
        dealsCount: 3,
        contractsCount: 2,
        invoicesCount: 2,
        invoicesAmount: 150000,
        paymentsCount: 1,
        margin: 45000,
        avgCheck: 75000,
      },
      create: {
        date: new Date('2026-03-19T00:00:00.000Z'),
        scope: 'TEAM',
        managerKey: 'team',
        managerId: null,
        callsTotal: 12,
        callsTarget: 7,
        dealsCount: 3,
        contractsCount: 2,
        invoicesCount: 2,
        invoicesAmount: 150000,
        paymentsCount: 1,
        margin: 45000,
        avgCheck: 75000,
      },
    })

    expect(result).toEqual({
      id: 'report-1',
      managerId: 'manager-1',
      date: '2026-03-19',
      calls_total: 12,
      calls_target: 7,
      deals_count: 3,
      contracts_count: 2,
      invoices_count: 2,
      invoices_amount_rub: 150000,
      payments_count: 1,
      margin_rub: 45000,
      comment: 'Closed strong',
      submittedAt: '2026-03-19T12:34:56.000Z',
      updatedAt: '2026-03-19T12:34:56.000Z',
    })
  })

  it('returns a manager report for the requested date', async () => {
    const prisma = {
      dailyReport: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'report-1',
          managerId: 'manager-1',
          date: new Date('2026-03-18T00:00:00.000Z'),
          callsTotal: 5,
          callsTarget: 3,
          dealsCount: 1,
          contractsCount: 1,
          invoicesCount: 1,
          invoicesAmount: 20000,
          paymentsCount: 1,
          margin: 7000,
          comment: '',
          submittedAt: new Date('2026-03-18T18:00:00.000Z'),
          updatedAt: new Date('2026-03-18T18:00:00.000Z'),
        }),
      },
    } as any

    const service = new ReportsService(prisma)

    await expect(service.getMyReport('manager-1', '2026-03-18')).resolves.toEqual({
      id: 'report-1',
      managerId: 'manager-1',
      date: '2026-03-18',
      calls_total: 5,
      calls_target: 3,
      deals_count: 1,
      contracts_count: 1,
      invoices_count: 1,
      invoices_amount_rub: 20000,
      payments_count: 1,
      margin_rub: 7000,
      comment: '',
      submittedAt: '2026-03-18T18:00:00.000Z',
      updatedAt: '2026-03-18T18:00:00.000Z',
    })
  })

  it('throws when a manager report does not exist', async () => {
    const prisma = {
      dailyReport: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    } as any

    const service = new ReportsService(prisma)

    await expect(service.getMyReport('manager-1', '2026-03-18')).rejects.toThrow(NotFoundException)
  })

  it('lists manager reports for a date range', async () => {
    const prisma = {
      dailyReport: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'report-2',
            managerId: 'manager-1',
            date: new Date('2026-03-19T00:00:00.000Z'),
            callsTotal: 10,
            callsTarget: 8,
            dealsCount: 2,
            contractsCount: 1,
            invoicesCount: 1,
            invoicesAmount: 100000,
            paymentsCount: 1,
            margin: 30000,
            comment: 'Today',
            submittedAt: new Date('2026-03-19T18:00:00.000Z'),
            updatedAt: new Date('2026-03-19T18:00:00.000Z'),
          },
        ]),
      },
    } as any

    const service = new ReportsService(prisma)
    const result = await service.listMyReports('manager-1', '2026-03-13', '2026-03-19')

    expect(prisma.dailyReport.findMany).toHaveBeenCalledWith({
      where: {
        managerId: 'manager-1',
        date: {
          gte: new Date('2026-03-13T00:00:00.000Z'),
          lte: new Date('2026-03-19T00:00:00.000Z'),
        },
      },
      orderBy: {
        date: 'desc',
      },
    })

    expect(result).toHaveLength(1)
    expect(result[0].date).toBe('2026-03-19')
  })

  it('keeps DailyReport as the only write path when CRM aggregation is configured as source of truth', async () => {
    process.env.DAILY_METRICS_SOURCE_OF_TRUTH = 'crm_aggregation'

    const prisma = {
      dailyReport: {
        upsert: jest.fn().mockResolvedValue({
          id: 'report-1',
          managerId: 'manager-1',
          date: new Date('2026-03-19T00:00:00.000Z'),
          callsTotal: 12,
          callsTarget: 7,
          dealsCount: 3,
          contractsCount: 2,
          invoicesCount: 2,
          invoicesAmount: 150000,
          paymentsCount: 1,
          margin: 45000,
          comment: 'Closed strong',
          submittedAt: new Date('2026-03-19T12:34:56.000Z'),
          updatedAt: new Date('2026-03-19T12:34:56.000Z'),
        }),
      },
      dailyMetrics: {
        upsert: jest.fn(),
        findMany: jest.fn(),
      },
    } as any

    const service = new ReportsService(prisma)
    await service.upsertMyReport('manager-1', '2026-03-19', {
      calls_total: 12,
      calls_target: 7,
      deals_count: 3,
      contracts_count: 2,
      invoices_count: 2,
      invoices_amount_rub: 150000,
      payments_count: 1,
      margin_rub: 45000,
      comment: 'Closed strong',
    })

    expect(prisma.dailyReport.upsert).toHaveBeenCalled()
    expect(prisma.dailyMetrics.upsert).not.toHaveBeenCalled()
    expect(prisma.dailyMetrics.findMany).not.toHaveBeenCalled()
  })
})
