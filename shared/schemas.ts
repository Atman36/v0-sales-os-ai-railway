import { z } from 'zod'

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/
export const MAX_COUNT_VALUE = 1_000_000
export const MAX_MONEY_VALUE = 9_999_999_999.99

export const CountMetricSchema = z.number().finite().min(0).max(MAX_COUNT_VALUE)
export const MoneyMetricSchema = z.number().finite().min(0).max(MAX_MONEY_VALUE)

const isValidIsoDate = (value: string) => {
  if (!isoDateRegex.test(value)) {
    return false
  }

  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  )
}

export const IsoDateSchema = z.string().regex(isoDateRegex).refine(isValidIsoDate, 'Invalid date')
export type IsoDate = z.infer<typeof IsoDateSchema>

export const UserRoleSchema = z.enum(['admin', 'user'])
export type UserRole = z.infer<typeof UserRoleSchema>

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: UserRoleSchema,
  managerId: z.string().nullable(),
})
export type User = z.infer<typeof UserSchema>

export const PasswordSchema = z.string().min(6).max(128)

const LoginIdentifierSchema = z.string().trim().email()

export const AuthLoginRequestSchema = z
  .object({
    login: LoginIdentifierSchema.optional(),
    email: LoginIdentifierSchema.optional(),
    password: PasswordSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.login && !value.email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['login'],
        message: 'login is required',
      })
    }

    if (value.login && value.email && value.login !== value.email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['email'],
        message: 'email must match login when both are provided',
      })
    }
  })
export type AuthLoginRequest = z.infer<typeof AuthLoginRequestSchema>

export const AuthLoginResponseSchema = z.object({
  user: UserSchema.optional(),
  accessToken: z.string(),
  managerId: z.string().nullable().optional(),
})
export type AuthLoginResponse = z.infer<typeof AuthLoginResponseSchema>

export const PasswordResetRequestSchema = z
  .object({
    email: z.string().trim().email(),
  })
  .strict()
export type PasswordResetRequest = z.infer<typeof PasswordResetRequestSchema>

export const PasswordResetRequestResponseSchema = z
  .object({
    message: z.string(),
    resetToken: z.string().optional(),
    expiresAt: z.string().optional(),
  })
  .strict()
export type PasswordResetRequestResponse = z.infer<typeof PasswordResetRequestResponseSchema>

export const PasswordResetConfirmSchema = z
  .object({
    token: z.string().min(32).max(512),
    password: PasswordSchema,
  })
  .strict()
export type PasswordResetConfirm = z.infer<typeof PasswordResetConfirmSchema>

export const PasswordResetConfirmResponseSchema = z
  .object({
    ok: z.literal(true),
  })
  .strict()
export type PasswordResetConfirmResponse = z.infer<typeof PasswordResetConfirmResponseSchema>

export const ManagerStatusSchema = z.enum(['on_track', 'warning', 'critical'])
export type ManagerStatus = z.infer<typeof ManagerStatusSchema>

export const ManagerSchema = z.object({
  id: z.string(),
  name: z.string(),
  avatarUrl: z.string().optional(),
  status: ManagerStatusSchema,
})
export type Manager = z.infer<typeof ManagerSchema>

export const AdminTeamUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  role: UserRoleSchema,
})
export type AdminTeamUser = z.infer<typeof AdminTeamUserSchema>

export const AdminTeamMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  avatarUrl: z.string().optional(),
  user: AdminTeamUserSchema.nullable(),
})
export type AdminTeamMember = z.infer<typeof AdminTeamMemberSchema>

export const AdminTeamListSchema = z.array(AdminTeamMemberSchema)
export type AdminTeamList = z.infer<typeof AdminTeamListSchema>

export const AdminTeamCreateRequestSchema = z
  .object({
    name: z.string().trim().min(1),
    avatarUrl: z.string().trim().nullable().optional(),
    user: z
      .object({
        email: z.string().trim().email(),
        password: PasswordSchema,
      })
      .strict(),
  })
  .strict()
export type AdminTeamCreateRequest = z.infer<typeof AdminTeamCreateRequestSchema>

export const AdminTeamUpdateRequestSchema = z
  .object({
    name: z.string().trim().min(1),
    avatarUrl: z.string().trim().nullable().optional(),
    user: z
      .object({
        email: z.string().trim().email().optional(),
        password: PasswordSchema.optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
export type AdminTeamUpdateRequest = z.infer<typeof AdminTeamUpdateRequestSchema>

export const MonthValueSchema = z.string().regex(/^\d{4}-\d{2}$/)
export type MonthValue = z.infer<typeof MonthValueSchema>

export const ManagerMonthlyPlanPayloadSchema = z
  .object({
    calls_total: CountMetricSchema,
    calls_target: CountMetricSchema,
    deals_count: CountMetricSchema,
    contracts_count: CountMetricSchema,
    invoices_count: CountMetricSchema,
    invoices_amount_rub: MoneyMetricSchema,
    payments_count: CountMetricSchema,
    margin_rub: MoneyMetricSchema,
    avg_check_rub: MoneyMetricSchema,
  })
  .strict()
export type ManagerMonthlyPlanPayload = z.infer<typeof ManagerMonthlyPlanPayloadSchema>

export const AdminManagerMonthlyPlanSchema = z
  .object({
    managerId: z.string(),
    month: MonthValueSchema,
    source: z.enum(['manager', 'tenant_default']),
    effectivePlan: ManagerMonthlyPlanPayloadSchema,
  })
  .strict()
export type AdminManagerMonthlyPlan = z.infer<typeof AdminManagerMonthlyPlanSchema>

export const AdminManagerMonthlyPlanUpsertRequestSchema = z
  .object({
    month: MonthValueSchema,
    plan: ManagerMonthlyPlanPayloadSchema,
  })
  .strict()
export type AdminManagerMonthlyPlanUpsertRequest = z.infer<typeof AdminManagerMonthlyPlanUpsertRequestSchema>

export const MetricSchema = z.object({
  plan: z.number(),
  fact: z.number(),
})
export type Metric = z.infer<typeof MetricSchema>

export const SalesMetricsSchema = z.object({
  month: z.string().optional(),
  calls_total: MetricSchema,
  calls_target: MetricSchema,
  cv_call_to_deal: MetricSchema,
  deals_count: MetricSchema,
  cv_deal_to_contract: MetricSchema,
  contracts_count: MetricSchema,
  cv_contract_to_invoice: MetricSchema,
  invoices_count: MetricSchema,
  invoices_amount_rub: MetricSchema,
  payments_count: MetricSchema,
  cv_invoice_to_payment: MetricSchema,
  margin_rub: MetricSchema,
  avg_check_rub: MetricSchema,
})
export type SalesMetrics = z.infer<typeof SalesMetricsSchema>

export const DailySalesSchema = z.object({
  date: z.string(),
  day: z.number(),
  calls_total: z.number(),
  calls_target: z.number(),
  deals_count: z.number(),
  contracts_count: z.number(),
  invoices_count: z.number(),
  invoices_amount_rub: z.number(),
  payments_count: z.number(),
  margin_rub: z.number(),
  avg_check_rub: z.number(),
})
export type DailySales = z.infer<typeof DailySalesSchema>

export const DailyPlanNoteSchema = z.object({
  date: z.string(),
  day: z.number(),
  plan_note_text: z.string(),
})
export type DailyPlanNote = z.infer<typeof DailyPlanNoteSchema>

export const ManagerProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  avatarUrl: z.string().optional(),
})
export type ManagerProfile = z.infer<typeof ManagerProfileSchema>

export const DailyReportSchema = z.object({
  id: z.string(),
  managerId: z.string(),
  date: IsoDateSchema,
  calls_total: CountMetricSchema,
  calls_target: CountMetricSchema,
  deals_count: CountMetricSchema,
  contracts_count: CountMetricSchema,
  invoices_count: CountMetricSchema,
  invoices_amount_rub: MoneyMetricSchema,
  payments_count: CountMetricSchema,
  margin_rub: MoneyMetricSchema,
  comment: z.string(),
  submittedAt: z.string(),
  updatedAt: z.string(),
})
export type DailyReport = z.infer<typeof DailyReportSchema>

export const DailyReportUpsertSchema = z
  .object({
    calls_total: CountMetricSchema,
    calls_target: CountMetricSchema,
    deals_count: CountMetricSchema,
    contracts_count: CountMetricSchema,
    invoices_count: CountMetricSchema,
    invoices_amount_rub: MoneyMetricSchema,
    payments_count: CountMetricSchema,
    margin_rub: MoneyMetricSchema,
    comment: z.string(),
  })
  .strict()
export type DailyReportUpsert = z.infer<typeof DailyReportUpsertSchema>

export const DailyReportRangeSchema = z
  .object({
    from: IsoDateSchema,
    to: IsoDateSchema,
  })
  .strict()
export type DailyReportRange = z.infer<typeof DailyReportRangeSchema>

export const ManagerDataSchema = z.object({
  manager: ManagerSchema,
  monthlyMetrics: SalesMetricsSchema,
  dailySales: z.array(DailySalesSchema).optional(),
  dailyNotes: z.array(DailyPlanNoteSchema).optional(),
  aiTip: z.string().optional(),
})
export type ManagerData = z.infer<typeof ManagerDataSchema>

export const ManagerDayResponseSchema = z.object({
  metrics: DailySalesSchema,
  note: DailyPlanNoteSchema.optional(),
})
export type ManagerDayResponse = z.infer<typeof ManagerDayResponseSchema>

export const MonthRangeSchema = z.object({
  value: z.string().regex(/^\d{4}-\d{2}$/),
  from: IsoDateSchema,
  to: IsoDateSchema,
})
export type MonthRange = z.infer<typeof MonthRangeSchema>

export const EffectivePlanSchema = z.record(z.number())
export type EffectivePlan = z.infer<typeof EffectivePlanSchema>

export const MeSummarySchema = z.object({
  manager: ManagerProfileSchema,
  month: MonthRangeSchema,
  monthMetrics: SalesMetricsSchema,
  todayMetrics: DailySalesSchema,
  todayReport: DailyReportSchema.nullable(),
  recentReports: z.array(DailyReportSchema),
  plan: EffectivePlanSchema,
})
export type MeSummary = z.infer<typeof MeSummarySchema>

export const MePlanSchema = z.object({
  manager: ManagerProfileSchema,
  month: MonthRangeSchema,
  monthMetrics: SalesMetricsSchema,
  dailyMetrics: z.array(DailySalesSchema),
  todayReport: DailyReportSchema.nullable(),
  plan: EffectivePlanSchema,
})
export type MePlan = z.infer<typeof MePlanSchema>

export const FunnelStageSchema = z.object({
  stage: z.string(),
  value: z.number(),
  plan: z.number(),
})
export type FunnelStage = z.infer<typeof FunnelStageSchema>

export const DashboardResponseSchema = z.object({
  period: z
    .object({
      from: z.string(),
      to: z.string(),
      label: z.string().optional(),
    })
    .optional(),
  updatedAt: z.string().optional(),
  totals: SalesMetricsSchema,
  funnel: z.array(FunnelStageSchema),
  team: z.array(ManagerDataSchema),
  aiSummary: z
    .object({
      title: z.string().optional(),
      text: z.string().optional(),
      recommendations: z.array(z.string()).optional(),
      bottleneckStage: z.string().optional(),
    })
    .optional(),
})
export type DashboardResponse = z.infer<typeof DashboardResponseSchema>

export const AIInsightTypeSchema = z.enum(['risk', 'opportunity', 'coach', 'anomaly'])
export type AIInsightType = z.infer<typeof AIInsightTypeSchema>

export const AIInsightSchema = z.object({
  id: z.string(),
  type: AIInsightTypeSchema,
  title: z.string(),
  summary: z.string(),
  why: z.string(),
  recommended_actions: z.array(z.string()),
  impact_estimate_rub: z.number().optional(),
  confidence: z.number().optional(),
  related_manager_ids: z.array(z.string()).optional(),
  related_metrics: z.array(z.string()).optional(),
})
export type AIInsight = z.infer<typeof AIInsightSchema>

const AIInsightsEnvelopeSchema = z.object({
  scope: z.enum(['TEAM', 'MANAGER']).optional(),
  insights: z.array(AIInsightSchema),
})

export const AIInsightsResponseSchema = z
  .union([AIInsightsEnvelopeSchema, z.array(AIInsightSchema)])
  .transform((value) => (Array.isArray(value) ? { insights: value } : value))

export type AIInsightsResponse = z.infer<typeof AIInsightsResponseSchema>
