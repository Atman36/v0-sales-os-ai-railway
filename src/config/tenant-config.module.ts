import { Module } from '@nestjs/common'
import { TenantConfigController } from './tenant-config.controller'
import { TenantConfigService } from './tenant-config.service'

@Module({
  controllers: [TenantConfigController],
  providers: [TenantConfigService],
  exports: [TenantConfigService],
})
export class TenantConfigModule {}
