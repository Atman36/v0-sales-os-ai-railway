import { BadRequestException, Controller, Get, Inject, Query, UseGuards } from '@nestjs/common'
import { z } from 'zod'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import { CurrentAuthUser, requireRopAccess } from '../auth/access-control'
import { DashboardService } from './dashboard.service'
import { parseOrThrow } from '../utils/validation'

const querySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
})

@Controller('dashboard')
export class DashboardController {
  constructor(@Inject(DashboardService) private readonly dashboardService: DashboardService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async getDashboard(@Query() query: unknown, @CurrentUser() user: CurrentAuthUser) {
    requireRopAccess(user)
    const params = parseOrThrow(querySchema, query)
    const now = new Date()
    const from = params.from ? new Date(params.from) : new Date(now.getFullYear(), now.getMonth(), 1)
    const to = params.to ? new Date(params.to) : now

    if (Number.isNaN(from.valueOf()) || Number.isNaN(to.valueOf())) {
      throw new BadRequestException('Invalid from/to dates')
    }

    return this.dashboardService.getDashboard(from, to)
  }
}
