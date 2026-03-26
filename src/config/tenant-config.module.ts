import { Module, forwardRef } from '@nestjs/common'
import { AggregationModule } from '../aggregation/aggregation.module'
import { TenantConfigController } from './tenant-config.controller'
import { TenantConfigService } from './tenant-config.service'

@Module({
  imports: [forwardRef(() => AggregationModule)],
  controllers: [TenantConfigController],
  providers: [TenantConfigService],
  exports: [TenantConfigService],
})
export class TenantConfigModule {}
