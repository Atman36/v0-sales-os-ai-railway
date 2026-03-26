import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { TenantConfigService } from '../config/tenant-config.service'
import { AppLogger } from '../logger/logger.service'
import {
  aggregateManagerPlans,
  buildEffectivePlan,
  buildSalesMetrics,
  formatMonthValue,
  MetricsTotals,
  normalizePlanDefaults,
} from '../metrics/metrics.utils'
import {
  buildManagerAiTip,
  buildTeamAiSummary,
  type NormalizedAIInsight,
  normalizeInsightRecord,
} from '../ai/insights.utils'

type DailyMetricsRecord = {
  date: Date
  managerId: string | null
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

const funnelStageConfig: Record<string, { label: string; planKey?: string }> = {
  CALLS: { label: 'Звонки', planKey: 'calls_total' },
  TARGETED: { label: 'Целевые', planKey: 'calls_target' },
  DEALS: { label: 'Сделки', planKey: 'deals_count' },
  CONTRACTS: { label: 'Договоры', planKey: 'contracts_count' },
  INVOICES: { label: 'Счета', planKey: 'invoices_count' },
  PAYMENTS: { label: 'Оплаты', planKey: 'payments_count' },
  'Звонки': { label: 'Звонки', planKey: 'calls_total' },
  'Целевые': { label: 'Целевые', planKey: 'calls_target' },
  'Сделки': { label: 'Сделки', planKey: 'deals_count' },
  'Договоры': { label: 'Договоры', planKey: 'contracts_count' },
  'Счета': { label: 'Счета', planKey: 'invoices_count' },
  'Оплаты': { label: 'Оплаты', planKey: 'payments_count' },
}

@Injectable()
export class DashboardService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TenantConfigService) private readonly configService: TenantConfigService,
    private readonly logger: AppLogger,
  ) {}

  async getDashboard(from: Date, to: Date) {
    const config = await this.configService.getConfig()
    const tenantPlanDefaults = normalizePlanDefaults((config.planDefaults ?? {}) as Record<string, number>)

    const teamMetrics = await this.prisma.dailyMetrics.findMany({
      where: {
        date: { gte: from, lte: to },
        scope: 'TEAM',
      },
    })

    const totals = teamMetrics.reduce<MetricsTotals>(
      (acc, item) => {
        acc.callsTotal += item.callsTotal
        acc.callsTarget += item.callsTarget
        acc.dealsCount += item.dealsCount
        acc.contractsCount += item.contractsCount
        acc.invoicesCount += item.invoicesCount
        acc.invoicesAmount += Number(item.invoicesAmount)
        acc.paymentsCount += item.paymentsCount
        acc.margin += Number(item.margin)
        acc.avgCheck += Number(item.avgCheck)
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

    const avgCheckFact = totals.invoicesCount > 0 ? totals.invoicesAmount / totals.invoicesCount : 0
    totals.avgCheck = avgCheckFact

    const managers = await this.prisma.manager.findMany()
    const monthValue = formatMonthValue(from)
    const monthlyPlans = managers.length && this.prisma.managerMonthlyPlan
      ? await this.prisma.managerMonthlyPlan.findMany({
          where: {
            managerId: { in: managers.map((manager) => manager.id) },
            month: monthValue,
          },
        })
      : []
    const monthlyPlansByManager = new Map(
      monthlyPlans.map((item) => [item.managerId, buildEffectivePlan(tenantPlanDefaults, item.plan)]),
    )
    const teamPlanDefaults = aggregateManagerPlans(
      managers.map((manager) => monthlyPlansByManager.get(manager.id) ?? buildEffectivePlan(tenantPlanDefaults)),
      tenantPlanDefaults,
    )

    const kpis = {
      margin: { plan: teamPlanDefaults.margin_rub ?? 0, fact: totals.margin },
      invoices: { plan: teamPlanDefaults.invoices_count ?? 0, fact: totals.invoicesCount },
      payments: { plan: teamPlanDefaults.payments_count ?? 0, fact: totals.paymentsCount },
      avgCheck: { plan: teamPlanDefaults.avg_check_rub ?? 0, fact: avgCheckFact },
    }

    const totalsMetrics = buildSalesMetrics(totals, teamPlanDefaults)

    const funnelRaw = await this.prisma.dealStageHistory.groupBy({
      by: ['stageKey'],
      where: {
        changedAt: { gte: from, lte: to },
      },
      _count: { stageKey: true },
    })

    const funnel = funnelRaw.map((row) => ({
      stage: funnelStageConfig[row.stageKey]?.label ?? row.stageKey,
      value: row._count.stageKey,
      plan: funnelStageConfig[row.stageKey]?.planKey
        ? teamPlanDefaults[funnelStageConfig[row.stageKey].planKey!] ?? 0
        : 0,
    }))

    const insightsState = await this.getInsights(from, to)
    const insights = insightsState.insights
    const teamInsights = insights.filter((insight) => insight.scope === 'TEAM')

    const metrics = await this.prisma.dailyMetrics.findMany({
      where: {
        scope: 'MANAGER',
        managerId: { in: managers.map((m) => m.id) },
        date: { gte: from, lte: to },
      },
    })

    const metricsByManager = metrics.reduce((acc, item) => {
      const key = item.managerId ?? 'unknown'
      if (!acc[key]) {
        acc[key] = {
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
      }
      acc[key].callsTotal += item.callsTotal
      acc[key].callsTarget += item.callsTarget
      acc[key].dealsCount += item.dealsCount
      acc[key].contractsCount += item.contractsCount
      acc[key].invoicesCount += item.invoicesCount
      acc[key].invoicesAmount += Number(item.invoicesAmount)
      acc[key].paymentsCount += item.paymentsCount
      acc[key].margin += Number(item.margin)
      return acc
    }, {} as Record<string, MetricsTotals>)

    const dailyMetricsByManager = metrics.reduce((acc, item) => {
      const key = item.managerId ?? 'unknown'
      if (!acc[key]) {
        acc[key] = []
      }
      acc[key].push(item)
      return acc
    }, {} as Record<string, DailyMetricsRecord[]>)

    const team = managers.map((manager) => {
      const effectivePlan = monthlyPlansByManager.get(manager.id) ?? buildEffectivePlan(tenantPlanDefaults)
      const managerMetrics = metricsByManager[manager.id] ?? {
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
      const avgCheck = managerMetrics.invoicesCount > 0 ? managerMetrics.invoicesAmount / managerMetrics.invoicesCount : 0
      managerMetrics.avgCheck = avgCheck

      const plan = effectivePlan.margin_rub ?? 0
      const progress = plan > 0 ? managerMetrics.margin / plan : 0
      const status = progress >= 0.9 ? 'on_track' : progress >= 0.7 ? 'warning' : 'critical'

      const dailySales = [...(dailyMetricsByManager[manager.id] ?? [])]
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .map((item) => this.mapDailyMetrics(item, item.date))

      return {
        manager: {
          id: manager.id,
          name: manager.name,
          avatarUrl: manager.avatarUrl ?? undefined,
          status,
        },
        monthlyMetrics: buildSalesMetrics(managerMetrics, effectivePlan),
        dailySales,
        aiTip: buildManagerAiTip(insights, manager.id),
      }
    })

    const bottleneckStage = funnel.reduce<{ stage?: string; ratio: number }>(
      (best, item) => {
        if (item.plan <= 0) {
          return best
        }
        const ratio = item.value / item.plan
        return ratio < best.ratio ? { stage: item.stage, ratio } : best
      },
      { stage: undefined, ratio: Number.POSITIVE_INFINITY },
    ).stage

    const planCompletion =
      teamPlanDefaults.margin_rub && teamPlanDefaults.margin_rub > 0
        ? Math.round((totals.margin / teamPlanDefaults.margin_rub) * 100)
        : 0

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      updatedAt: new Date().toISOString(),
      totals: totalsMetrics,
      funnel,
      team,
      aiSummary: buildTeamAiSummary(teamInsights, { bottleneckStage, planCompletion }),
      kpis,
      aiInsights: insightsState.degraded ? { degraded: true } : undefined,
      teamHealth: team.map((entry) => ({
        managerId: entry.manager.id,
        name: entry.manager.name,
        progress:
          (entry.monthlyMetrics.margin_rub.plan ?? 0) > 0
            ? entry.monthlyMetrics.margin_rub.fact / entry.monthlyMetrics.margin_rub.plan
            : 0,
        status: entry.manager.status,
        aiTip: entry.aiTip,
      })),
    }
  }

  private mapDailyMetrics(metrics: DailyMetricsRecord, date: Date) {
    return {
      date: date.toISOString().slice(0, 10),
      day: date.getDate(),
      calls_total: metrics.callsTotal,
      calls_target: metrics.callsTarget,
      deals_count: metrics.dealsCount,
      contracts_count: metrics.contractsCount,
      invoices_count: metrics.invoicesCount,
      invoices_amount_rub: Number(metrics.invoicesAmount),
      payments_count: metrics.paymentsCount,
      margin_rub: Number(metrics.margin),
      avg_check_rub: Number(metrics.avgCheck),
    }
  }

  private async getInsights(
    from: Date,
    to: Date,
  ): Promise<{ insights: NormalizedAIInsight[]; degraded: boolean }> {
    try {
      const rawInsights = await this.prisma.aIInsight.findMany({
        orderBy: { createdAt: 'desc' },
      })
      return {
        insights: rawInsights.map((insight) => normalizeInsightRecord(insight)),
        degraded: false,
      }
    } catch (error) {
      this.logger.error({
        msg: 'Failed to load AI insights for dashboard response',
        scope: 'dashboard',
        from: from.toISOString(),
        to: to.toISOString(),
        error,
      })
      return {
        insights: [],
        degraded: true,
      }
    }
  }
}
