import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { TEAM_METRICS_KEY } from '../metrics/metric-keys'
import { canManualReportsWriteDailyMetrics } from '../metrics/daily-metrics-source-of-truth'
import { formatReportDate, parseReportDate } from './reports.utils'

type DailyReportPayload = {
  calls_total: number
  calls_target: number
  deals_count: number
  contracts_count: number
  invoices_count: number
  invoices_amount_rub: number
  payments_count: number
  margin_rub: number
  comment: string
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

type DailyReportSaveOutcome = 'report_saved_metrics_synced' | 'report_saved_only'

@Injectable()
export class ReportsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getMyReport(managerId: string, date: string) {
    const reportDate = parseReportDate(date)
    const report = await this.prisma.dailyReport.findUnique({
      where: {
        managerId_date: {
          managerId,
          date: reportDate,
        },
      },
    })

    if (!report) {
      throw new NotFoundException('Daily report not found')
    }

    return this.mapReport(report)
  }

  async upsertMyReport(managerId: string, date: string, payload: DailyReportPayload) {
    const reportDate = parseReportDate(date)
    const submittedAt = new Date()
    const data = {
      callsTotal: payload.calls_total,
      callsTarget: payload.calls_target,
      dealsCount: payload.deals_count,
      contractsCount: payload.contracts_count,
      invoicesCount: payload.invoices_count,
      invoicesAmount: payload.invoices_amount_rub,
      paymentsCount: payload.payments_count,
      margin: payload.margin_rub,
      comment: payload.comment,
      submittedAt,
    }

    const report = await this.prisma.dailyReport.upsert({
      where: {
        managerId_date: {
          managerId,
          date: reportDate,
        },
      },
      update: data,
      create: {
        managerId,
        date: reportDate,
        ...data,
      },
    })

    if (canManualReportsWriteDailyMetrics()) {
      await this.syncManagerMetrics(managerId, reportDate, payload)
      await this.syncTeamMetrics(reportDate)

      return {
        report: this.mapReport(report),
        outcome: 'report_saved_metrics_synced' as DailyReportSaveOutcome,
      }
    }

    return {
      report: this.mapReport(report),
      outcome: 'report_saved_only' as DailyReportSaveOutcome,
    }
  }

  private async syncManagerMetrics(managerId: string, date: Date, payload: DailyReportPayload) {
    const avgCheck = payload.invoices_count > 0 ? payload.invoices_amount_rub / payload.invoices_count : 0
    const fields = {
      callsTotal: payload.calls_total,
      callsTarget: payload.calls_target,
      dealsCount: payload.deals_count,
      contractsCount: payload.contracts_count,
      invoicesCount: payload.invoices_count,
      invoicesAmount: payload.invoices_amount_rub,
      paymentsCount: payload.payments_count,
      margin: payload.margin_rub,
      avgCheck,
    }

    await this.prisma.dailyMetrics.upsert({
      where: { date_managerKey: { date, managerKey: managerId } },
      update: fields,
      create: {
        date,
        scope: 'MANAGER',
        managerKey: managerId,
        managerId,
        ...fields,
      },
    })
  }

  private async syncTeamMetrics(date: Date) {
    const managerRows = await this.prisma.dailyMetrics.findMany({
      where: { date, scope: 'MANAGER' },
    })

    const totals = managerRows.reduce(
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
      { callsTotal: 0, callsTarget: 0, dealsCount: 0, contractsCount: 0, invoicesCount: 0, invoicesAmount: 0, paymentsCount: 0, margin: 0 },
    )

    const avgCheck = totals.invoicesCount > 0 ? totals.invoicesAmount / totals.invoicesCount : 0

    await this.prisma.dailyMetrics.upsert({
      where: { date_managerKey: { date, managerKey: TEAM_METRICS_KEY } },
      update: { ...totals, avgCheck },
      create: {
        date,
        scope: 'TEAM',
        managerKey: TEAM_METRICS_KEY,
        managerId: null,
        ...totals,
        avgCheck,
      },
    })
  }

  async listSubmittedManagerIds(date: string) {
    const reportDate = parseReportDate(date)
    const reports = await this.prisma.dailyReport.findMany({
      where: { date: reportDate },
      select: { managerId: true },
    })

    return [...new Set(reports.map((report) => report.managerId))]
  }

  async getLatestManagerReport(managerId: string) {
    const report = await this.prisma.dailyReport.findFirst({
      where: { managerId },
      orderBy: [{ date: 'desc' }, { submittedAt: 'desc' }],
    })

    return report ? this.mapReport(report) : null
  }

  async listMyReports(managerId: string, from: string, to: string) {
    const fromDate = parseReportDate(from)
    const toDate = parseReportDate(to)
    const reports = await this.prisma.dailyReport.findMany({
      where: {
        managerId,
        date: {
          gte: fromDate,
          lte: toDate,
        },
      },
      orderBy: {
        date: 'desc',
      },
    })

    return reports.map((report) => this.mapReport(report))
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
