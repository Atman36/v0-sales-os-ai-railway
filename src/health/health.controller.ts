import { Controller, Get } from '@nestjs/common'
import { getDailyMetricsSourceOfTruth } from '../metrics/daily-metrics-source-of-truth'

@Controller('health')
export class HealthController {
  @Get()
  health() {
    return {
      status: 'ok',
      time: new Date().toISOString(),
      dailyMetrics: {
        sourceOfTruth: getDailyMetricsSourceOfTruth(),
      },
    }
  }
}
