import { Body, Controller, Headers, Post, UseGuards } from '@nestjs/common'
import { Throttle, ThrottlerGuard } from '@nestjs/throttler'
import { BitrixService } from './bitrix.service'

@Controller('webhooks')
export class BitrixController {
  constructor(private bitrixService: BitrixService) {}

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 60, ttl: 60 } })
  @Post('bitrix')
  async handleWebhook(
    @Headers('x-salesos-secret') secret: string | undefined,
    @Body() body: Record<string, any>,
  ) {
    return this.bitrixService.handleWebhook(body ?? {}, secret)
  }
}
