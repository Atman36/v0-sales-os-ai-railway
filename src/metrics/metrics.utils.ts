export type MetricsTotals = {
  callsTotal: number
  callsTarget: number
  dealsCount: number
  contractsCount: number
  invoicesCount: number
  invoicesAmount: number
  paymentsCount: number
  margin: number
  avgCheck: number
}

export type PlanDefaults = Record<string, number>
export const MANAGER_MONTHLY_PLAN_KEYS = [
  'calls_total',
  'calls_target',
  'deals_count',
  'contracts_count',
  'invoices_count',
  'invoices_amount_rub',
  'payments_count',
  'margin_rub',
  'avg_check_rub',
] as const
export const MANAGER_MONTHLY_PLAN_KEY_SET = new Set<string>(MANAGER_MONTHLY_PLAN_KEYS)

const metric = (plan: number, fact: number) => ({ plan, fact })
const percent = (value: number) => Math.round(value * 100)

export const normalizePlanDefaults = (raw: PlanDefaults) => {
  const plan = { ...raw }
  if (plan.margin_rub === undefined && plan.margin !== undefined) plan.margin_rub = plan.margin
  if (plan.invoices_count === undefined && plan.invoices !== undefined) plan.invoices_count = plan.invoices
  if (plan.payments_count === undefined && plan.payments !== undefined) plan.payments_count = plan.payments
  if (plan.avg_check_rub === undefined && plan.avgCheck !== undefined) plan.avg_check_rub = plan.avgCheck
  if (plan.invoices_amount_rub === undefined && plan.invoices_amount !== undefined) {
    plan.invoices_amount_rub = plan.invoices_amount
  }
  return plan
}

export const normalizePlanRecord = (raw: unknown) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {}
  }

  const normalized: PlanDefaults = {}

  for (const [key, value] of Object.entries(raw)) {
    const num = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
    if (Number.isFinite(num)) {
      normalized[key] = num
    }
  }

  return normalizePlanDefaults(normalized)
}

export const buildEffectivePlan = (tenantDefaults: unknown, personalPlan?: unknown) =>
  normalizePlanDefaults({
    ...normalizePlanRecord(tenantDefaults),
    ...normalizePlanRecord(personalPlan),
  })

export const aggregateManagerPlans = (plans: PlanDefaults[], tenantDefaults: PlanDefaults) => {
  const aggregated = normalizePlanDefaults({ ...tenantDefaults })

  for (const key of MANAGER_MONTHLY_PLAN_KEYS) {
    aggregated[key] = plans.reduce((sum, plan) => sum + (plan[key] ?? 0), 0)
  }

  return aggregated
}

export const formatMonthValue = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export const buildSalesMetrics = (totals: MetricsTotals, planDefaults: PlanDefaults) => {
  const callsDenominator = totals.callsTarget > 0 ? totals.callsTarget : totals.callsTotal
  const cvCallToDeal = callsDenominator > 0 ? percent(totals.dealsCount / callsDenominator) : 0
  const cvDealToContract = totals.dealsCount > 0 ? percent(totals.contractsCount / totals.dealsCount) : 0
  const cvContractToInvoice = totals.contractsCount > 0 ? percent(totals.invoicesCount / totals.contractsCount) : 0
  const cvInvoiceToPayment = totals.invoicesCount > 0 ? percent(totals.paymentsCount / totals.invoicesCount) : 0

  return {
    calls_total: metric(planDefaults.calls_total ?? 0, totals.callsTotal),
    calls_target: metric(planDefaults.calls_target ?? 0, totals.callsTarget),
    cv_call_to_deal: metric(planDefaults.cv_call_to_deal ?? 0, cvCallToDeal),
    deals_count: metric(planDefaults.deals_count ?? 0, totals.dealsCount),
    cv_deal_to_contract: metric(planDefaults.cv_deal_to_contract ?? 0, cvDealToContract),
    contracts_count: metric(planDefaults.contracts_count ?? 0, totals.contractsCount),
    cv_contract_to_invoice: metric(planDefaults.cv_contract_to_invoice ?? 0, cvContractToInvoice),
    invoices_count: metric(planDefaults.invoices_count ?? 0, totals.invoicesCount),
    invoices_amount_rub: metric(planDefaults.invoices_amount_rub ?? 0, totals.invoicesAmount),
    payments_count: metric(planDefaults.payments_count ?? 0, totals.paymentsCount),
    cv_invoice_to_payment: metric(planDefaults.cv_invoice_to_payment ?? 0, cvInvoiceToPayment),
    margin_rub: metric(planDefaults.margin_rub ?? 0, totals.margin),
    avg_check_rub: metric(planDefaults.avg_check_rub ?? 0, totals.avgCheck),
  }
}
