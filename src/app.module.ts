import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { ThrottlerModule } from '@nestjs/throttler'
import { LoggerModule } from './logger/logger.module'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './auth/auth.module'
import { TenantConfigModule } from './config/tenant-config.module'
import { IngestionModule } from './ingestion/bitrix.module'
import { DashboardModule } from './dashboard/dashboard.module'
import { ManagersModule } from './managers/managers.module'
import { AIInsightsModule } from './ai/ai.module'
import { AggregationModule } from './aggregation/aggregation.module'
import { HealthModule } from './health/health.module'
import { CallQueueModule } from './queue/call-queue.module'
import { ImportModule } from './import/import.module'
import { ReportsModule } from './reports/reports.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60,
        limit: 300,
      },
    ]),
    LoggerModule,
    PrismaModule,
    AuthModule,
    TenantConfigModule,
    IngestionModule,
    DashboardModule,
    ManagersModule,
    AIInsightsModule,
    AggregationModule,
    ReportsModule,
    CallQueueModule.register(),
    HealthModule,
    ImportModule,
  ],
})
export class AppModule {}
