import { Module } from '@nestjs/common'
import { TenantConfigModule } from '../config/tenant-config.module'
import { LoggerModule } from '../logger/logger.module'
import { AggregationService } from './aggregation.service'

@Module({
  imports: [TenantConfigModule, LoggerModule],
  providers: [AggregationService],
  exports: [AggregationService],
})
export class AggregationModule {}
