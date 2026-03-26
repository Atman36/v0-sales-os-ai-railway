import { Module } from '@nestjs/common'
import { AIInsightsController } from './ai.controller'
import { AIInsightsService } from './ai.service'

@Module({
  controllers: [AIInsightsController],
  providers: [AIInsightsService],
})
export class AIInsightsModule {}
