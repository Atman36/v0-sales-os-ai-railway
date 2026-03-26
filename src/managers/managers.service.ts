import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { normalizeUserRole, toUserRole } from '@shared/roles'
import bcrypt from 'bcryptjs'
import { PrismaService } from '../prisma/prisma.service'
import { TenantConfigService } from '../config/tenant-config.service'
import { buildEffectivePlan, buildSalesMetrics, MetricsTotals, normalizePlanDefaults } from '../metrics/metrics.utils'
import { AppLogger } from '../logger/logger.service'
import { buildManagerAiTip, normalizeInsightRecord, type NormalizedAIInsight } from '../ai/insights.utils'

type AdminTeamCreatePayload = {
  name: string
  avatarUrl?: string | null
  user: {
    email: string
    password: string
  }
}

type AdminTeamUpdatePayload = {
  name: string
  avatarUrl?: string | null
  user?: {
    email?: string
    password?: string
  }
}

type ManagerMonthlyPlanPayload = {
  calls_total: number
  calls_target: number
  deals_count: number
  contracts_count: number
  invoices_count: number
  invoices_amount_rub: number
  payments_count: number
  margin_rub: number
  avg_check_rub: number
}

@Injectable()
export class ManagersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TenantConfigService) private readonly configService: TenantConfigService,
    private readonly logger: AppLogger,
  ) {}

  async listAdminTeam() {
    const managers = await this.prisma.manager.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    })

    return managers.map((manager) => this.mapAdminTeamMember(manager))
  }

  async createAdminTeamMember(payload: AdminTeamCreatePayload) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const manager = await tx.manager.create({
          data: {
            name: payload.name,
            avatarUrl: payload.avatarUrl ?? null,
          },
        })

        await tx.user.create({
          data: {
            email: payload.user.email,
            passwordHash: await bcrypt.hash(payload.user.password, 10),
            name: payload.name,
            role: 'USER',
            managerId: manager.id,
          },
        })

        const saved = await tx.manager.findUnique({
          where: { id: manager.id },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                role: true,
              },
            },
          },
        })

        if (!saved) {
          throw new NotFoundException('Manager not found')
        }

        return this.mapAdminTeamMember(saved)
      })
    } catch (error) {
      throw this.mapAdminTeamWriteError(error)
    }
  }

  async updateAdminTeamMember(id: string, payload: AdminTeamUpdatePayload) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const current = await tx.manager.findUnique({
          where: { id },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                role: true,
              },
            },
          },
        })

        if (!current) {
          throw new NotFoundException('Manager not found')
        }

        await tx.manager.update({
          where: { id },
          data: {
            name: payload.name,
            avatarUrl: payload.avatarUrl ?? null,
          },
        })

        if (current.user) {
          const userUpdate: {
            name: string
            email?: string
            passwordHash?: string
          } = {
            name: payload.name,
          }

          if (payload.user?.email) {
            userUpdate.email = payload.user.email
          }

          if (payload.user?.password) {
            userUpdate.passwordHash = await bcrypt.hash(payload.user.password, 10)
          }

          await tx.user.update({
            where: { id: current.user.id },
            data: userUpdate,
          })
        } else if (payload.user) {
          if (!payload.user.email || !payload.user.password) {
            throw new BadRequestException('Email and password are required to create linked user')
          }

          await tx.user.create({
            data: {
              email: payload.user.email,
              passwordHash: await bcrypt.hash(payload.user.password, 10),
              name: payload.name,
              role: 'USER',
              managerId: id,
            },
          })
        }

        const saved = await tx.manager.findUnique({
          where: { id },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                role: true,
              },
            },
          },
        })

        if (!saved) {
          throw new NotFoundException('Manager not found')
        }

        return this.mapAdminTeamMember(saved)
      })
    } catch (error) {
      throw this.mapAdminTeamWriteError(error)
    }
  }

  async getAdminManagerMonthlyPlan(id: string, month: string) {
    await this.requireManager(id)
    const defaults = await this.getTenantPlanDefaults()
    const personalPlan = this.prisma.managerMonthlyPlan
      ? await this.prisma.managerMonthlyPlan.findUnique({
          where: {
            managerId_month: {
              managerId: id,
              month,
            },
          },
        })
      : null

    return {
      managerId: id,
      month,
      source: personalPlan ? 'manager' : 'tenant_default',
      effectivePlan: buildEffectivePlan(defaults, personalPlan?.plan),
    }
  }

  async upsertAdminManagerMonthlyPlan(id: string, month: string, plan: ManagerMonthlyPlanPayload) {
    await this.requireManager(id)
    if (!this.prisma.managerMonthlyPlan) {
      throw new Error('Manager monthly plans are not available')
    }

    await this.prisma.managerMonthlyPlan.upsert({
      where: {
        managerId_month: {
          managerId: id,
          month,
        },
      },
      update: {
        plan,
      },
      create: {
        managerId: id,
        month,
        plan,
      },
    })

    const defaults = await this.getTenantPlanDefaults()

    return {
      managerId: id,
      month,
      source: 'manager' as const,
      effectivePlan: buildEffectivePlan(defaults, plan),
    }
  }

  async listManagers(month: string) {
    const managers = await this.prisma.manager.findMany()
    const insightsState = await this.getInsights({ scope: 'managers_list', month })
    return Promise.all(
      managers.map((manager) =>
        this.buildManagerData(manager.id, month, false, undefined, insightsState.insights, insightsState.degraded),
      ),
    )
  }

  async getManager(id: string, month: string, dailyFrom?: string) {
    const manager = await this.prisma.manager.findUnique({ where: { id } })
    if (!manager) throw new NotFoundException('Manager not found')
    const insightsState = await this.getInsights({ scope: 'manager_detail', month, managerId: id, dailyFrom })
    return this.buildManagerData(id, month, true, dailyFrom, insightsState.insights, insightsState.degraded)
  }

  async getManagerDay(id: string, date: string) {
    const day = this.parseDate(date)
    const metrics = await this.prisma.dailyMetrics.findFirst({
      where: {
        managerId: id,
        scope: 'MANAGER',
        date: day,
      },
    })

    const note = await this.prisma.dailyPlanNote.findUnique({
      where: { managerId_date: { managerId: id, date: day } },
    })

    return {
      metrics: this.mapDailyMetrics(metrics, day),
      note: note
        ? {
            date: day.toISOString().slice(0, 10),
            day: day.getDate(),
            plan_note_text: note.note,
          }
        : undefined,
    }
  }

  async upsertPlanNote(id: string, date: string, text: string) {
    const day = this.parseDate(date)
    const note = await this.prisma.dailyPlanNote.upsert({
      where: { managerId_date: { managerId: id, date: day } },
      update: { note: text },
      create: { managerId: id, date: day, note: text },
    })

    return {
      date: day.toISOString().slice(0, 10),
      day: day.getDate(),
      plan_note_text: note.note,
    }
  }

  private async buildManagerData(
    id: string,
    month: string,
    includeDaily: boolean,
    dailyFrom?: string,
    insights: NormalizedAIInsight[] = [],
    insightsDegraded = false,
  ) {
    const manager = await this.prisma.manager.findUnique({ where: { id } })
    if (!manager) throw new NotFoundException('Manager not found')

    const { from, to } = this.parseMonth(month)
    const planDefaults = await this.getEffectivePlan(id, month)

    const metrics = await this.prisma.dailyMetrics.findMany({
      where: {
        managerId: id,
        scope: 'MANAGER',
        date: { gte: from, lte: to },
      },
    })

    const totals = metrics.reduce<MetricsTotals>(
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

    const plan = planDefaults.margin_rub ?? 0
    const progress = plan > 0 ? totals.margin / plan : 0
    const status = progress >= 0.9 ? 'on_track' : progress >= 0.7 ? 'warning' : 'critical'

    const data: any = {
      manager: {
        id: manager.id,
        name: manager.name,
        avatarUrl: manager.avatarUrl ?? undefined,
        status,
      },
      monthlyMetrics: buildSalesMetrics(totals, planDefaults),
      aiTip: buildManagerAiTip(insights, id),
      aiInsights: insightsDegraded ? { degraded: true } : undefined,
    }

    if (includeDaily) {
      const dailyRange = dailyFrom
        ? { gte: this.parseDate(dailyFrom), lte: new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), 23, 59, 59, 999)) }
        : { gte: from, lte: to }

      const dailyMetrics = dailyFrom
        ? await this.prisma.dailyMetrics.findMany({
            where: { managerId: id, scope: 'MANAGER', date: dailyRange },
          })
        : metrics

      const notes = await this.prisma.dailyPlanNote.findMany({
        where: { managerId: id, date: dailyRange },
      })

      const sortedMetrics = [...dailyMetrics].sort((a, b) => a.date.getTime() - b.date.getTime())
      data.dailySales = sortedMetrics.map((item) => this.mapDailyMetrics(item, item.date))
      const sortedNotes = [...notes].sort((a, b) => a.date.getTime() - b.date.getTime())
      data.dailyNotes = sortedNotes.map((note) => ({
        date: note.date.toISOString().slice(0, 10),
        day: note.date.getDate(),
        plan_note_text: note.note,
      }))
    }

    return data
  }

  private mapDailyMetrics(
    metrics: { date: Date; callsTotal: number; callsTarget: number; dealsCount: number; contractsCount: number; invoicesCount: number; invoicesAmount: any; paymentsCount: number; margin: any; avgCheck: any } | null,
    date: Date,
  ) {
    return {
      date: date.toISOString().slice(0, 10),
      day: date.getDate(),
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

  private parseMonth(month: string) {
    const [yearStr, monthStr] = month.split('-')
    const year = Number(yearStr)
    const monthIndex = Number(monthStr) - 1
    const from = new Date(Date.UTC(year, monthIndex, 1))
    const to = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999))
    return { from, to }
  }

  private parseDate(date: string) {
    const parsed = new Date(date)
    if (Number.isNaN(parsed.valueOf())) {
      throw new Error('Invalid date')
    }
    return parsed
  }

  private async getInsights(context: {
    scope: 'managers_list' | 'manager_detail'
    month: string
    managerId?: string
    dailyFrom?: string
  }): Promise<{ insights: NormalizedAIInsight[]; degraded: boolean }> {
    try {
      const insights = await this.prisma.aIInsight.findMany({
        orderBy: { createdAt: 'desc' },
      })
      return {
        insights: insights.map((insight) => normalizeInsightRecord(insight)),
        degraded: false,
      }
    } catch (error) {
      this.logger.error({
        msg: 'Failed to load AI insights for managers response',
        scope: context.scope,
        month: context.month,
        managerId: context.managerId,
        dailyFrom: context.dailyFrom,
        error,
      })
      return {
        insights: [],
        degraded: true,
      }
    }
  }

  private async requireManager(id: string) {
    const manager = await this.prisma.manager.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!manager) {
      throw new NotFoundException('Manager not found')
    }
  }

  private async getTenantPlanDefaults() {
    return normalizePlanDefaults(((await this.configService.getConfig()).planDefaults ?? {}) as Record<string, number>)
  }

  private async getEffectivePlan(managerId: string, month: string) {
    const defaults = await this.getTenantPlanDefaults()
    const personalPlan = this.prisma.managerMonthlyPlan
      ? await this.prisma.managerMonthlyPlan.findUnique({
          where: {
            managerId_month: {
              managerId,
              month,
            },
          },
        })
      : null

    return buildEffectivePlan(defaults, personalPlan?.plan)
  }

  private mapAdminTeamMember(manager: {
    id: string
    name: string
    avatarUrl: string | null
    user?: {
      id: string
      email: string
      role: 'ADMIN' | 'USER'
    } | null
  }) {
    const role = manager.user ? normalizeUserRole(manager.user.role) : null

    return {
      id: manager.id,
      name: manager.name,
      avatarUrl: manager.avatarUrl ?? undefined,
      user: manager.user
        ? {
            id: manager.user.id,
            email: manager.user.email,
            role: role ?? toUserRole('MANAGER'),
          }
        : null,
    }
  }

  private mapAdminTeamWriteError(error: unknown) {
    if (error instanceof BadRequestException || error instanceof NotFoundException) {
      return error
    }

    if (this.isUniqueConstraintError(error)) {
      const targets = Array.isArray(error.meta?.target)
        ? error.meta.target.map(String)
        : error.meta?.target
          ? [String(error.meta.target)]
          : []

      if (targets.some((target) => target.includes('email'))) {
        return new ConflictException('User email already exists')
      }

      return new ConflictException('Manager or linked user already exists')
    }

    return error instanceof Error ? error : new Error('Failed to write manager data')
  }

  private isUniqueConstraintError(
    error: unknown,
  ): error is { code: string; meta?: { target?: string[] | string } } {
    return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'P2002')
  }
}
