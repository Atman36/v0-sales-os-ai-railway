import { Injectable } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { Prisma } from '@prisma/client'
import { AppLogger } from '../logger/logger.service'
import { PrismaService } from '../prisma/prisma.service'
import { TenantConfigService } from '../config/tenant-config.service'
import { TEAM_METRICS_KEY } from '../metrics/metric-keys'
import {
  canAggregationWriteDailyMetrics,
  getDailyMetricsSourceOfTruth,
} from '../metrics/daily-metrics-source-of-truth'

@Injectable()
export class AggregationService {
  constructor(
    private prisma: PrismaService,
    private configService: TenantConfigService,
    private logger: AppLogger,
  ) {}

  async recomputeRange(from: Date, to: Date) {
    const timeZone = await this.getTimeZone()
    const startKey = this.formatDateKey(from, timeZone)
    const endKey = this.formatDateKey(to, timeZone)

    const dates = this.enumerateDateKeys(startKey, endKey)
    for (const dateKey of dates) {
      const date = this.dateKeyToUtc(dateKey)
      await this.recomputeForDate(date)
    }

    return { status: 'ok', from: startKey, to: endKey, days: dates.length }
  }

  async recomputeForDate(date: Date, managerId?: string) {
    if (!canAggregationWriteDailyMetrics()) {
      const source = getDailyMetricsSourceOfTruth()
      const dateKey = date.toISOString().slice(0, 10)
      this.logger.warn({
        msg: 'Skipping DailyMetrics recompute because aggregation is not the authoritative source',
        date: dateKey,
        managerId,
        sourceOfTruth: source,
      })
      return { status: 'skipped', date: dateKey, reason: 'daily_metrics_source_guard', sourceOfTruth: source }
    }

    const timeZone = await this.getTimeZone()
    const dateKey = this.formatDateKey(date, timeZone)
    const { start, end } = this.dayBounds(dateKey, timeZone)
    const metricsDate = this.dateKeyToUtc(dateKey)

    let managerIds: string[]
    if (managerId) {
      const exists = await this.prisma.manager.findUnique({ where: { id: managerId } })
      if (!exists) {
        return { status: 'skipped', date: dateKey }
      }
      managerIds = [managerId]
    } else {
      managerIds = (await this.prisma.manager.findMany({ select: { id: true } })).map((m) => m.id)
    }

    const stageRows = await this.prisma.dealStageHistory.groupBy({
      by: ['managerId', 'stageKey'],
      where: {
        changedAt: { gte: start, lte: end },
        ...(managerId ? { managerId } : {}),
      },
      _count: { _all: true },
      _sum: { amount: true },
    })

    const callRows = await this.prisma.call.groupBy({
      by: ['managerId'],
      where: {
        occurredAt: { gte: start, lte: end },
        ...(managerId ? { managerId } : {}),
      },
      _count: { _all: true },
    })

    const stageMap = new Map<string, Map<string, { count: number; amount: number }>>()
    for (const row of stageRows) {
      const key = row.managerId ?? 'unassigned'
      if (!stageMap.has(key)) stageMap.set(key, new Map())
      stageMap.get(key)!.set(row.stageKey, {
        count: row._count._all,
        amount: Number(row._sum.amount ?? 0),
      })
    }

    const callMap = new Map<string, number>()
    for (const row of callRows) {
      const key = row.managerId ?? 'unassigned'
      callMap.set(key, row._count._all)
    }

    const teamTotals = {
      callsTotal: 0,
      callsTarget: 0,
      dealsCount: 0,
      contractsCount: 0,
      invoicesCount: 0,
      invoicesAmount: 0,
      paymentsCount: 0,
      margin: 0,
      avgCheck: 0,
    }

    for (const id of managerIds) {
      const metrics = this.buildMetricsForManager(id, stageMap, callMap)
      teamTotals.callsTotal += metrics.callsTotal
      teamTotals.callsTarget += metrics.callsTarget
      teamTotals.dealsCount += metrics.dealsCount
      teamTotals.contractsCount += metrics.contractsCount
      teamTotals.invoicesCount += metrics.invoicesCount
      teamTotals.invoicesAmount += metrics.invoicesAmount
      teamTotals.paymentsCount += metrics.paymentsCount
      teamTotals.margin += metrics.margin

      await this.upsertDailyMetrics(metricsDate, id, metrics)
    }

    const unassignedMetrics = this.buildMetricsForManager('unassigned', stageMap, callMap)
    teamTotals.callsTotal += unassignedMetrics.callsTotal
    teamTotals.callsTarget += unassignedMetrics.callsTarget
    teamTotals.dealsCount += unassignedMetrics.dealsCount
    teamTotals.contractsCount += unassignedMetrics.contractsCount
    teamTotals.invoicesCount += unassignedMetrics.invoicesCount
    teamTotals.invoicesAmount += unassignedMetrics.invoicesAmount
    teamTotals.paymentsCount += unassignedMetrics.paymentsCount
    teamTotals.margin += unassignedMetrics.margin

    teamTotals.avgCheck = teamTotals.invoicesCount > 0 ? teamTotals.invoicesAmount / teamTotals.invoicesCount : 0

    await this.prisma.dailyMetrics.upsert({
      where: { date_managerKey: { date: metricsDate, managerKey: TEAM_METRICS_KEY } },
      update: {
        scope: 'TEAM',
        managerKey: TEAM_METRICS_KEY,
        managerId: null,
        callsTotal: teamTotals.callsTotal,
        callsTarget: teamTotals.callsTarget,
        dealsCount: teamTotals.dealsCount,
        contractsCount: teamTotals.contractsCount,
        invoicesCount: teamTotals.invoicesCount,
        invoicesAmount: new Prisma.Decimal(teamTotals.invoicesAmount),
        paymentsCount: teamTotals.paymentsCount,
        margin: new Prisma.Decimal(teamTotals.margin),
        avgCheck: new Prisma.Decimal(teamTotals.avgCheck),
      },
      create: {
        date: metricsDate,
        scope: 'TEAM',
        managerKey: TEAM_METRICS_KEY,
        managerId: null,
        callsTotal: teamTotals.callsTotal,
        callsTarget: teamTotals.callsTarget,
        dealsCount: teamTotals.dealsCount,
        contractsCount: teamTotals.contractsCount,
        invoicesCount: teamTotals.invoicesCount,
        invoicesAmount: new Prisma.Decimal(teamTotals.invoicesAmount),
        paymentsCount: teamTotals.paymentsCount,
        margin: new Prisma.Decimal(teamTotals.margin),
        avgCheck: new Prisma.Decimal(teamTotals.avgCheck),
      },
    })

    this.logger.log({ msg: 'DailyMetrics recomputed', date: dateKey })
    return { status: 'ok', date: dateKey }
  }

  @Cron('15 2 * * *')
  async nightlyAggregation() {
    const timeZone = await this.getTimeZone()
    const now = new Date()
    const todayKey = this.formatDateKey(now, timeZone)
    const todayDate = this.dateKeyToUtc(todayKey)
    const yesterday = new Date(todayDate)
    yesterday.setUTCDate(yesterday.getUTCDate() - 1)
    await this.recomputeForDate(todayDate)
    await this.recomputeForDate(yesterday)
  }

  private buildMetricsForManager(
    managerKey: string,
    stageMap: Map<string, Map<string, { count: number; amount: number }>>,
    callMap: Map<string, number>,
  ) {
    const stages = stageMap.get(managerKey) ?? new Map()
    const callsTotal = callMap.get(managerKey) ?? 0

    const getCount = (key: string) => stages.get(key)?.count ?? 0
    const getAmount = (key: string) => stages.get(key)?.amount ?? 0

    const callsTarget = stages.has('TARGETED') ? getCount('TARGETED') : callsTotal
    const dealsCount = getCount('DEALS')
    const contractsCount = getCount('CONTRACTS')
    const invoicesCount = getCount('INVOICES')
    const invoicesAmount = getAmount('INVOICES')
    const paymentsCount = getCount('PAYMENTS')
    const margin = getAmount('PAYMENTS')
    const avgCheck = invoicesCount > 0 ? invoicesAmount / invoicesCount : 0

    return {
      callsTotal,
      callsTarget,
      dealsCount,
      contractsCount,
      invoicesCount,
      invoicesAmount,
      paymentsCount,
      margin,
      avgCheck,
    }
  }

  private async upsertDailyMetrics(date: Date, managerId: string, metrics: any) {
    await this.prisma.dailyMetrics.upsert({
      where: { date_managerKey: { date, managerKey: managerId } },
      update: {
        scope: 'MANAGER',
        managerKey: managerId,
        managerId,
        callsTotal: metrics.callsTotal,
        callsTarget: metrics.callsTarget,
        dealsCount: metrics.dealsCount,
        contractsCount: metrics.contractsCount,
        invoicesCount: metrics.invoicesCount,
        invoicesAmount: new Prisma.Decimal(metrics.invoicesAmount),
        paymentsCount: metrics.paymentsCount,
        margin: new Prisma.Decimal(metrics.margin),
        avgCheck: new Prisma.Decimal(metrics.avgCheck),
      },
      create: {
        date,
        scope: 'MANAGER',
        managerKey: managerId,
        managerId,
        callsTotal: metrics.callsTotal,
        callsTarget: metrics.callsTarget,
        dealsCount: metrics.dealsCount,
        contractsCount: metrics.contractsCount,
        invoicesCount: metrics.invoicesCount,
        invoicesAmount: new Prisma.Decimal(metrics.invoicesAmount),
        paymentsCount: metrics.paymentsCount,
        margin: new Prisma.Decimal(metrics.margin),
        avgCheck: new Prisma.Decimal(metrics.avgCheck),
      },
    })
  }

  private async getTimeZone() {
    const config = await this.configService.getConfig()
    return config.timezone || 'UTC'
  }

  private formatDateKey(date: Date, timeZone: string) {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    return formatter.format(date)
  }

  private enumerateDateKeys(startKey: string, endKey: string) {
    const dates: string[] = []
    let cursor = this.dateKeyToUtc(startKey)
    const end = this.dateKeyToUtc(endKey)
    while (cursor <= end) {
      dates.push(cursor.toISOString().slice(0, 10))
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
    return dates
  }

  private dateKeyToUtc(dateKey: string) {
    return new Date(`${dateKey}T00:00:00Z`)
  }

  private dayBounds(dateKey: string, timeZone: string) {
    return {
      start: this.zonedTimeToUtc(dateKey, timeZone, 0, 0, 0, 0),
      end: this.zonedTimeToUtc(dateKey, timeZone, 23, 59, 59, 999),
    }
  }

  private zonedTimeToUtc(dateKey: string, timeZone: string, hour: number, minute: number, second: number, ms: number) {
    const [year, month, day] = dateKey.split('-').map((value) => Number(value))
    const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute, second, ms))
    const tzDate = new Date(utcDate.toLocaleString('en-US', { timeZone }))
    const offset = utcDate.getTime() - tzDate.getTime()
    return new Date(utcDate.getTime() + offset)
  }
}
