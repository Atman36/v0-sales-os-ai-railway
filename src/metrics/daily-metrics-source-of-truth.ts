export const DAILY_METRICS_SOURCE_MANUAL_REPORTS = 'manual_reports'
export const DAILY_METRICS_SOURCE_CRM_AGGREGATION = 'crm_aggregation'
const DAILY_METRICS_SOURCE_ENV_NAME = 'DAILY_METRICS_SOURCE_OF_TRUTH'

export type DailyMetricsSourceOfTruth =
  | typeof DAILY_METRICS_SOURCE_MANUAL_REPORTS
  | typeof DAILY_METRICS_SOURCE_CRM_AGGREGATION

const ALLOWED_SOURCES: DailyMetricsSourceOfTruth[] = [
  DAILY_METRICS_SOURCE_MANUAL_REPORTS,
  DAILY_METRICS_SOURCE_CRM_AGGREGATION,
]
const ALLOWED_SOURCES_SET = new Set<DailyMetricsSourceOfTruth>(ALLOWED_SOURCES)

export function getDailyMetricsSourceOfTruth(env: NodeJS.ProcessEnv = process.env): DailyMetricsSourceOfTruth {
  const rawValue = env.DAILY_METRICS_SOURCE_OF_TRUTH?.trim().toLowerCase()

  if (!rawValue) {
    throw new Error(`${DAILY_METRICS_SOURCE_ENV_NAME} must be configured`)
  }

  if (!ALLOWED_SOURCES_SET.has(rawValue as DailyMetricsSourceOfTruth)) {
    throw new Error(`${DAILY_METRICS_SOURCE_ENV_NAME} must be one of: ${ALLOWED_SOURCES.join(', ')}`)
  }

  return rawValue as DailyMetricsSourceOfTruth
}

export function assertDailyMetricsSourceOfTruthConfigured(env: NodeJS.ProcessEnv = process.env) {
  return getDailyMetricsSourceOfTruth(env)
}

export function canManualReportsWriteDailyMetrics(source = getDailyMetricsSourceOfTruth()) {
  return source === DAILY_METRICS_SOURCE_MANUAL_REPORTS
}

export function canAggregationWriteDailyMetrics(source = getDailyMetricsSourceOfTruth()) {
  return source === DAILY_METRICS_SOURCE_CRM_AGGREGATION
}
