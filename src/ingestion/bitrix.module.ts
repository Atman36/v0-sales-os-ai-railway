import { Module } from '@nestjs/common'
import { BitrixController } from './bitrix.controller'
import { BitrixService } from './bitrix.service'

@Module({
  controllers: [BitrixController],
  providers: [BitrixService],
})
export class IngestionModule {}
