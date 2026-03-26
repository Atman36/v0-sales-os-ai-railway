import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common'
import { z } from 'zod'
import { JwtAuthGuard } from './jwt-auth.guard'
import { CurrentUser } from './current-user.decorator'
import { parseOrThrow } from '../utils/validation'
import { requireManagerId, type CurrentAuthUser } from './access-control'
import { MeService } from './me.service'

const monthSchema = z
  .object({
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
  })
  .strict()

@Controller()
export class MeController {
  constructor(@Inject(MeService) private readonly meService: MeService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() user: { sub: string; email: string; role: string; name?: string; managerId?: string | null }) {
    return {
      id: user.sub,
      email: user.email,
      role: user.role,
      name: user.name ?? 'User',
      managerId: user.managerId ?? null,
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/summary')
  async summary(@CurrentUser() user: CurrentAuthUser) {
    return this.meService.getSummary(requireManagerId(user))
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/plan')
  async plan(
    @Query() query: unknown,
    @CurrentUser() user: CurrentAuthUser,
  ) {
    const params = parseOrThrow(monthSchema, query)
    return this.meService.getPlan(requireManagerId(user), params.month ?? this.currentMonth())
  }

  private currentMonth() {
    return new Date().toISOString().slice(0, 7)
  }
}
