import { BadRequestException, Body, Controller, Get, Inject, Param, Post, Put, Query, UseGuards } from '@nestjs/common'
import { z } from 'zod'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import { CurrentAuthUser, requireManagerAccess, requireRopAccess } from '../auth/access-control'
import { ManagersService } from './managers.service'
import { countMetricSchema, moneyMetricSchema } from '../utils/metric-schemas'
import { parseOrThrow } from '../utils/validation'

const monthSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  dailyFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

const noteSchema = z.object({
  text: z.string().min(0),
})

const monthlyPlanSchema = z
  .object({
    calls_total: countMetricSchema,
    calls_target: countMetricSchema,
    deals_count: countMetricSchema,
    contracts_count: countMetricSchema,
    invoices_count: countMetricSchema,
    invoices_amount_rub: moneyMetricSchema,
    payments_count: countMetricSchema,
    margin_rub: moneyMetricSchema,
    avg_check_rub: moneyMetricSchema,
  })
  .strict()

const adminMonthlyPlanQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
})

const adminMonthlyPlanUpsertSchema = z
  .object({
    month: z.string().regex(/^\d{4}-\d{2}$/),
    plan: monthlyPlanSchema,
  })
  .strict()

const adminTeamCreateSchema = z
  .object({
    name: z.string().trim().min(1),
    avatarUrl: z.string().trim().nullable().optional(),
    user: z
      .object({
        email: z.string().trim().email(),
        password: z.string().min(6),
      })
      .strict(),
  })
  .strict()

const adminTeamUpdateSchema = z
  .object({
    name: z.string().trim().min(1),
    avatarUrl: z.string().trim().nullable().optional(),
    user: z
      .object({
        email: z.string().trim().email().optional(),
        password: z.string().min(6).optional(),
      })
      .strict()
      .optional(),
  })
  .strict()

@Controller('managers')
@UseGuards(JwtAuthGuard)
export class ManagersController {
  constructor(@Inject(ManagersService) private readonly managersService: ManagersService) {}

  @Get('admin/team')
  async listAdminTeam(@CurrentUser() user: CurrentAuthUser) {
    requireRopAccess(user)
    return this.managersService.listAdminTeam()
  }

  @Post('admin/team')
  async createAdminTeamMember(@Body() body: unknown, @CurrentUser() user: CurrentAuthUser) {
    requireRopAccess(user)
    const payload = parseOrThrow(adminTeamCreateSchema, body)
    return this.managersService.createAdminTeamMember(payload)
  }

  @Put('admin/team/:id')
  async updateAdminTeamMember(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: CurrentAuthUser,
  ) {
    requireRopAccess(user)
    const payload = parseOrThrow(adminTeamUpdateSchema, body)
    return this.managersService.updateAdminTeamMember(id, payload)
  }

  @Get('admin/team/:id/monthly-plan')
  async getAdminManagerMonthlyPlan(@Param('id') id: string, @Query() query: unknown, @CurrentUser() user: CurrentAuthUser) {
    requireRopAccess(user)
    const params = parseOrThrow(adminMonthlyPlanQuerySchema, query)
    return this.managersService.getAdminManagerMonthlyPlan(id, params.month)
  }

  @Put('admin/team/:id/monthly-plan')
  async upsertAdminManagerMonthlyPlan(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: CurrentAuthUser,
  ) {
    requireRopAccess(user)
    const payload = parseOrThrow(adminMonthlyPlanUpsertSchema, body)
    return this.managersService.upsertAdminManagerMonthlyPlan(id, payload.month, payload.plan)
  }

  @Get()
  async listManagers(@Query() query: unknown, @CurrentUser() user: CurrentAuthUser) {
    requireRopAccess(user)
    const params = parseOrThrow(monthSchema, query)
    const month = params.month ?? this.currentMonth()
    return this.managersService.listManagers(month)
  }

  @Get(':id')
  async getManager(@Param('id') id: string, @Query() query: unknown, @CurrentUser() user: CurrentAuthUser) {
    const managerId = requireManagerAccess(user, id)
    const params = parseOrThrow(monthSchema, query)
    const month = params.month ?? this.currentMonth()
    return this.managersService.getManager(managerId, month, params.dailyFrom)
  }

  @Get(':id/days/:date')
  async getManagerDay(@Param('id') id: string, @Param('date') date: string, @CurrentUser() user: CurrentAuthUser) {
    const managerId = requireManagerAccess(user, id)
    try {
      return await this.managersService.getManagerDay(managerId, date)
    } catch (error) {
      throw new BadRequestException('Invalid date')
    }
  }

  @Put(':id/days/:date/plan-note')
  async updatePlanNote(
    @Param('id') id: string,
    @Param('date') date: string,
    @Body() body: unknown,
    @CurrentUser() user: CurrentAuthUser,
  ) {
    const managerId = requireManagerAccess(user, id)
    const payload = parseOrThrow(noteSchema, body)
    try {
      return await this.managersService.upsertPlanNote(managerId, date, payload.text)
    } catch (error) {
      throw new BadRequestException('Invalid date')
    }
  }

  private currentMonth() {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    return `${year}-${month}`
  }
}
