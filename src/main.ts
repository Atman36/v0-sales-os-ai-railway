import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { ConfigService } from '@nestjs/config'
import { AppModule } from './app.module'
import { AppLogger } from './logger/logger.service'
import { createCorsOptions } from './cors.config'
import { assertDailyMetricsSourceOfTruthConfigured } from './metrics/daily-metrics-source-of-truth'
import { assertTokenRevocationBackendConfigured } from './auth/token-revocation.config'

async function bootstrap() {
  assertDailyMetricsSourceOfTruthConfigured()
  const app = await NestFactory.create(AppModule, { bufferLogs: true })
  const logger = app.get(AppLogger)
  app.useLogger(logger)
  app.enableCors(createCorsOptions())
  app.enableShutdownHooks()

  const config = app.get(ConfigService)
  assertTokenRevocationBackendConfigured(
    config.get<string>('AUTH_TOKEN_REVOCATION_BACKEND'),
    config.get<string>('NODE_ENV'),
  )
  const port = Number(config.get('API_PORT') ?? 4000)

  await app.listen(port)
  logger.log(`API listening on ${port}`)
}

bootstrap()
