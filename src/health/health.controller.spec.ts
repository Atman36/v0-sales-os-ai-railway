import { HealthController } from './health.controller'

describe('HealthController', () => {
  const originalSourceOfTruth = process.env.DAILY_METRICS_SOURCE_OF_TRUTH

  afterEach(() => {
    if (originalSourceOfTruth === undefined) {
      delete process.env.DAILY_METRICS_SOURCE_OF_TRUTH
    } else {
      process.env.DAILY_METRICS_SOURCE_OF_TRUTH = originalSourceOfTruth
    }
  })

  it('surfaces the configured DailyMetrics source of truth', () => {
    process.env.DAILY_METRICS_SOURCE_OF_TRUTH = 'crm_aggregation'

    const controller = new HealthController()

    expect(controller.health()).toMatchObject({
      status: 'ok',
      dailyMetrics: {
        sourceOfTruth: 'crm_aggregation',
      },
    })
  })
})
