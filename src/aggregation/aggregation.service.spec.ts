import { AggregationService } from './aggregation.service'

describe('AggregationService', () => {
  const originalSourceOfTruth = process.env.DAILY_METRICS_SOURCE_OF_TRUTH

  beforeEach(() => {
    process.env.DAILY_METRICS_SOURCE_OF_TRUTH = 'manual_reports'
  })

  afterEach(() => {
    if (originalSourceOfTruth === undefined) {
      delete process.env.DAILY_METRICS_SOURCE_OF_TRUTH
    } else {
      process.env.DAILY_METRICS_SOURCE_OF_TRUTH = originalSourceOfTruth
    }
  })

  it('skips recompute when DailyMetrics are reserved for manual reports', async () => {
    const prisma = {
      manager: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      dealStageHistory: {
        groupBy: jest.fn(),
      },
      call: {
        groupBy: jest.fn(),
      },
      dailyMetrics: {
        upsert: jest.fn(),
      },
    } as any
    const tenantConfig = {
      getConfig: jest.fn(),
    } as any
    const logger = {
      warn: jest.fn(),
      log: jest.fn(),
    } as any

    const service = new AggregationService(prisma, tenantConfig, logger)
    const result = await service.recomputeForDate(new Date('2026-03-19T00:00:00.000Z'))

    expect(result).toEqual({
      status: 'skipped',
      date: '2026-03-19',
      reason: 'daily_metrics_source_guard',
      sourceOfTruth: 'manual_reports',
    })
    expect(logger.warn).toHaveBeenCalledWith({
      msg: 'Skipping DailyMetrics recompute because aggregation is not the authoritative source',
      date: '2026-03-19',
      managerId: undefined,
      sourceOfTruth: 'manual_reports',
    })
    expect(tenantConfig.getConfig).not.toHaveBeenCalled()
    expect(prisma.manager.findMany).not.toHaveBeenCalled()
    expect(prisma.dailyMetrics.upsert).not.toHaveBeenCalled()
  })
})
