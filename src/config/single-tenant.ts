export const SINGLE_TENANT_GUARDRAILS = Object.freeze({
  mode: 'single_company',
  tenantIsolation: false,
  configScope: 'shared_company_defaults',
  message:
    'Sales OS currently runs as a single-company app. TenantConfig stores shared company defaults and does not provide tenant isolation.',
})

export function withSingleTenantGuardrails<T extends Record<string, unknown>>(payload: T) {
  return {
    ...payload,
    guardrails: SINGLE_TENANT_GUARDRAILS,
  }
}
