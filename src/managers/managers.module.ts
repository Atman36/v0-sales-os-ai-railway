import { Module } from '@nestjs/common'
import { TenantConfigModule } from '../config/tenant-config.module'
import { LoggerModule } from '../logger/logger.module'
import { ManagersController } from './managers.controller'
import { ManagersService } from './managers.service'

@Module({
  imports: [TenantConfigModule, LoggerModule],
  controllers: [ManagersController],
  providers: [ManagersService],
})
export class ManagersModule {}
