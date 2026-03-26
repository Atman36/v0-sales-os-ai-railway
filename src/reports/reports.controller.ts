import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common'
import { z } from 'zod'
import { CurrentAuthUser, requireManagerAccess, requireManagerId, requireRopAccess } from '../auth/access-control'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import { parseOrThrow } from '../utils/validation'
import { countMetricSchema, moneyMetricSchema } from '../utils/metric-schemas'
import { ReportsService } from './reports.service'
import { parseReportDate, reportDateRegex } from './reports.utils'

const dateSchema = z.string().regex(reportDateRegex)

const dailyReportPayloadSchema = z
  .object({
    calls_total: countMetricSchema,
    calls_target: countMetricSchema,
    deals_count: countMetricSchema,
    contracts_count: countMetricSchema,
    invoices_count: countMetricSchema,
    invoices_amount_rub: moneyMetricSchema,
    payments_count: countMetricSchema,
    margin_rub: moneyMetricSchema,
    comment: z.string(),
  })
  .strict()

const reportsRangeSchema = z
  .object({
    from: dateSchema,
    to: dateSchema,
  })
  .strict()

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(@Inject(ReportsService) private readonly reportsService: ReportsService) {}

  @Get('submitted/:date')
  async listSubmittedManagerIds(@Param('date') date: string, @CurrentUser() user: CurrentAuthUser) {
    requireRopAccess(user)
    this.ensureValidDate(date)
    const managerIds = await this.reportsService.listSubmittedManagerIds(date)
    return { date, managerIds }
  }

  @Get('latest/:managerId')
  async getLatestManagerReport(@Param('managerId') managerId: string, @CurrentUser() user: CurrentAuthUser) {
    const allowedManagerId = requireManagerAccess(user, managerId)
    return this.reportsService.getLatestManagerReport(allowedManagerId)
  }

  @Get('me/:date')
  async getMyReport(@Param('date') date: string, @CurrentUser() user: CurrentAuthUser) {
    const managerId = this.requireManagerId(user)
    this.ensureValidDate(date)
    return this.reportsService.getMyReport(managerId, date)
  }

  @Put('me/:date')
  async upsertMyReport(@Param('date') date: string, @Body() body: unknown, @CurrentUser() user: CurrentAuthUser) {
    const managerId = this.requireManagerId(user)
    this.ensureValidDate(date)
    const payload = parseOrThrow(dailyReportPayloadSchema, body)
    return this.reportsService.upsertMyReport(managerId, date, payload)
  }

  @Get('me')
  async listMyReports(@Query() query: unknown, @CurrentUser() user: CurrentAuthUser) {
    const managerId = this.requireManagerId(user)
    const params = parseOrThrow(reportsRangeSchema, query)
    const fromDate = this.ensureValidDate(params.from)
    const toDate = this.ensureValidDate(params.to)

    if (fromDate.getTime() > toDate.getTime()) {
      throw new BadRequestException('Invalid date range')
    }

    return this.reportsService.listMyReports(managerId, params.from, params.to)
  }

  private requireManagerId(user: CurrentAuthUser) {
    return requireManagerId(user)
  }

  private ensureValidDate(date: string) {
    try {
      return parseReportDate(date)
    } catch {
      throw new BadRequestException('Invalid date')
    }
  }
}
