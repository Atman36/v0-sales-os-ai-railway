import { Module } from '@nestjs/common'
import { TenantConfigModule } from '../config/tenant-config.module'
import { LoggerModule } from '../logger/logger.module'
import { DashboardController } from './dashboard.controller'
import { DashboardService } from './dashboard.service'

@Module({
  imports: [TenantConfigModule, LoggerModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
