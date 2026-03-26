import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { TenantConfigService } from '../config/tenant-config.service'
import { buildEffectivePlan, buildSalesMetrics, type MetricsTotals } from '../metrics/metrics.utils'
import { formatReportDate, parseReportDate } from '../reports/reports.utils'

type DailyMetricsRecord = {
  date: Date
  callsTotal: number
  callsTarget: number
  dealsCount: number
  contractsCount: number
  invoicesCount: number
  invoicesAmount: unknown
  paymentsCount: number
  margin: unknown
  avgCheck: unknown
}

type DailyReportRecord = {
  id: string
  managerId: string
  date: Date
  callsTotal: number
  callsTarget: number
  dealsCount: number
  contractsCount: number
  invoicesCount: number
  invoicesAmount: unknown
  paymentsCount: number
  margin: unknown
  comment: string
  submittedAt: Date
  updatedAt: Date
}

@Injectable()
export class MeService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TenantConfigService) private readonly configService: TenantConfigService,
  ) {}

  async getSummary(managerId: string) {
    const monthValue = this.currentMonth()
    const context = await this.getMonthContext(managerId, monthValue)
    const today = parseReportDate(this.currentDate())
    const recentFrom = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000)

    const recentReports = await this.prisma.dailyReport.findMany({
      where: {
        managerId,
        date: {
          gte: recentFrom,
          lte: today,
        },
      },
      orderBy: {
        date: 'desc',
      },
    })

    const todayMetrics =
      context.dailyMetrics.find((item) => formatReportDate(item.date) === formatReportDate(today)) ?? null
    const todayReport =
      recentReports.find((item) => formatReportDate(item.date) === formatReportDate(today)) ?? null

    return {
      manager: context.manager,
      month: context.month,
      monthMetrics: context.monthMetrics,
      todayMetrics: this.mapDailyMetrics(todayMetrics, today),
      todayReport: todayReport ? this.mapReport(todayReport) : null,
      recentReports: recentReports.map((report) => this.mapReport(report)),
      plan: context.plan,
    }
  }

  async getPlan(managerId: string, monthValue: string) {
    const context = await this.getMonthContext(managerId, monthValue)
    const todayReport = await this.getTodayReportForMonth(managerId, context.month.value)

    return {
      manager: context.manager,
      month: context.month,
      monthMetrics: context.monthMetrics,
      dailyMetrics: context.dailyMetrics.map((item) => this.mapDailyMetrics(item, item.date)),
      todayReport: todayReport ? this.mapReport(todayReport) : null,
      plan: context.plan,
    }
  }

  private async getMonthContext(managerId: string, monthValue: string) {
    const manager = await this.prisma.manager.findUnique({
      where: { id: managerId },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
      },
    })

    if (!manager) {
      throw new NotFoundException('Manager not found')
    }

    const month = this.parseMonth(monthValue)
    const plan = await this.getEffectivePlan(managerId, month.value)
    const dailyMetrics = await this.prisma.dailyMetrics.findMany({
      where: {
        managerId,
        scope: 'MANAGER',
        date: {
          gte: parseReportDate(month.from),
          lte: parseReportDate(month.to),
        },
      },
      orderBy: {
        date: 'asc',
      },
    })

    const totals = dailyMetrics.reduce<MetricsTotals>(
      (acc, item) => {
        acc.callsTotal += item.callsTotal
        acc.callsTarget += item.callsTarget
        acc.dealsCount += item.dealsCount
        acc.contractsCount += item.contractsCount
        acc.invoicesCount += item.invoicesCount
        acc.invoicesAmount += Number(item.invoicesAmount)
        acc.paymentsCount += item.paymentsCount
        acc.margin += Number(item.margin)
        return acc
      },
      {
        callsTotal: 0,
        callsTarget: 0,
        dealsCount: 0,
        contractsCount: 0,
        invoicesCount: 0,
        invoicesAmount: 0,
        paymentsCount: 0,
        margin: 0,
        avgCheck: 0,
      },
    )

    totals.avgCheck = totals.invoicesCount > 0 ? totals.invoicesAmount / totals.invoicesCount : 0

    return {
      manager: {
        id: manager.id,
        name: manager.name,
        avatarUrl: manager.avatarUrl ?? undefined,
      },
      month,
      plan,
      monthMetrics: buildSalesMetrics(totals, plan),
      dailyMetrics,
    }
  }

  private async getEffectivePlan(managerId: string, monthValue: string) {
    const config = await this.configService.getConfig()
    const monthlyPlan = this.prisma.managerMonthlyPlan
      ? await this.prisma.managerMonthlyPlan.findUnique({
          where: {
            managerId_month: {
              managerId,
              month: monthValue,
            },
          },
        })
      : null

    return buildEffectivePlan(config.planDefaults ?? {}, monthlyPlan?.plan)
  }

  private async getTodayReportForMonth(managerId: string, monthValue: string) {
    const todayValue = this.currentDate()
    if (!todayValue.startsWith(monthValue)) {
      return null
    }

    return this.prisma.dailyReport.findUnique({
      where: {
        managerId_date: {
          managerId,
          date: parseReportDate(todayValue),
        },
      },
    })
  }

  private currentDate() {
    return formatReportDate(new Date())
  }

  private currentMonth() {
    return this.currentDate().slice(0, 7)
  }

  private parseMonth(month: string) {
    const match = month.match(/^(\d{4})-(\d{2})$/)
    if (!match) {
      throw new Error('Invalid month')
    }

    const year = Number(match[1])
    const monthIndex = Number(match[2]) - 1
    const from = new Date(Date.UTC(year, monthIndex, 1))
    const to = new Date(Date.UTC(year, monthIndex + 1, 0))

    if (
      from.getUTCFullYear() !== year ||
      from.getUTCMonth() !== monthIndex ||
      monthIndex < 0 ||
      monthIndex > 11
    ) {
      throw new Error('Invalid month')
    }

    return {
      value: month,
      from: formatReportDate(from),
      to: formatReportDate(to),
    }
  }

  private mapDailyMetrics(metrics: DailyMetricsRecord | null, date: Date) {
    return {
      date: formatReportDate(date),
      day: date.getUTCDate(),
      calls_total: metrics?.callsTotal ?? 0,
      calls_target: metrics?.callsTarget ?? 0,
      deals_count: metrics?.dealsCount ?? 0,
      contracts_count: metrics?.contractsCount ?? 0,
      invoices_count: metrics?.invoicesCount ?? 0,
      invoices_amount_rub: Number(metrics?.invoicesAmount ?? 0),
      payments_count: metrics?.paymentsCount ?? 0,
      margin_rub: Number(metrics?.margin ?? 0),
      avg_check_rub: Number(metrics?.avgCheck ?? 0),
    }
  }

  private mapReport(report: DailyReportRecord) {
    return {
      id: report.id,
      managerId: report.managerId,
      date: formatReportDate(report.date),
      calls_total: report.callsTotal,
      calls_target: report.callsTarget,
      deals_count: report.dealsCount,
      contracts_count: report.contractsCount,
      invoices_count: report.invoicesCount,
      invoices_amount_rub: Number(report.invoicesAmount),
      payments_count: report.paymentsCount,
      margin_rub: Number(report.margin),
      comment: report.comment,
      submittedAt: report.submittedAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
    }
  }
}
