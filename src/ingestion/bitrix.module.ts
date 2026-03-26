import { Module } from '@nestjs/common'
import { AggregationModule } from '../aggregation/aggregation.module'
import { LoggerModule } from '../logger/logger.module'
import { TenantConfigModule } from '../config/tenant-config.module'
import { BitrixController } from './bitrix.controller'
import { BitrixService } from './bitrix.service'

@Module({
  imports: [TenantConfigModule, AggregationModule, LoggerModule],
  controllers: [BitrixController],
  providers: [BitrixService],
})
export class IngestionModule {}
