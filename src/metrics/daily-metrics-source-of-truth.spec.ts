import {
  DAILY_METRICS_SOURCE_CRM_AGGREGATION,
  DAILY_METRICS_SOURCE_MANUAL_REPORTS,
  getDailyMetricsSourceOfTruth,
} from './daily-metrics-source-of-truth'

describe('daily-metrics-source-of-truth', () => {
  const originalSourceOfTruth = process.env.DAILY_METRICS_SOURCE_OF_TRUTH

  afterEach(() => {
    if (originalSourceOfTruth === undefined) {
      delete process.env.DAILY_METRICS_SOURCE_OF_TRUTH
    } else {
      process.env.DAILY_METRICS_SOURCE_OF_TRUTH = originalSourceOfTruth
    }
  })

  it('returns manual_reports when explicitly configured', () => {
    process.env.DAILY_METRICS_SOURCE_OF_TRUTH = DAILY_METRICS_SOURCE_MANUAL_REPORTS

    expect(getDailyMetricsSourceOfTruth()).toBe(DAILY_METRICS_SOURCE_MANUAL_REPORTS)
  })

  it('returns crm_aggregation when explicitly configured', () => {
    process.env.DAILY_METRICS_SOURCE_OF_TRUTH = DAILY_METRICS_SOURCE_CRM_AGGREGATION

    expect(getDailyMetricsSourceOfTruth()).toBe(DAILY_METRICS_SOURCE_CRM_AGGREGATION)
  })

  it('rejects missing env value', () => {
    delete process.env.DAILY_METRICS_SOURCE_OF_TRUTH

    expect(() => getDailyMetricsSourceOfTruth()).toThrow(
      'DAILY_METRICS_SOURCE_OF_TRUTH must be configured',
    )
  })

  it('rejects invalid env value', () => {
    process.env.DAILY_METRICS_SOURCE_OF_TRUTH = 'broken'

    expect(() => getDailyMetricsSourceOfTruth()).toThrow(
      'DAILY_METRICS_SOURCE_OF_TRUTH must be one of: manual_reports, crm_aggregation',
    )
  })

  it('rejects blank env value', () => {
    process.env.DAILY_METRICS_SOURCE_OF_TRUTH = '   '

    expect(() => getDailyMetricsSourceOfTruth()).toThrow(
      'DAILY_METRICS_SOURCE_OF_TRUTH must be configured',
    )
  })
})
