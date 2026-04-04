import demoFixturesJson from './demo-fixtures.json'
import { DEFAULT_INSECURE_SECRET, isDefaultSecret, isSafeEnv, normalizeSecret, resolveNodeEnv } from '@shared/runtime-env'

type DemoFixtureManager = {
  name: string
  externalId: string
}

type DemoFixtures = {
  admin: {
    email: string
    password: string
    name: string
  }
  tenantTimezone: string
  demoManagerPassword: string
  demoManagers: DemoFixtureManager[]
}

type SeedConfig = {
  adminEmail: string
  adminPassword: string
  adminName: string
  timezone: string
  demoManagerPassword: string
  demoManagers: DemoFixtureManager[]
}

const demoFixtures = demoFixturesJson as DemoFixtures

export const SEED_UNSAFE_ENV_ACK = 'ALLOW_SEED_IN_UNSAFE_ENV'

export function resolveSeedConfig(env: NodeJS.ProcessEnv = process.env): SeedConfig {
  return {
    adminEmail: env.ADMIN_EMAIL ?? demoFixtures.admin.email,
    adminPassword: env.ADMIN_PASSWORD ?? demoFixtures.admin.password,
    adminName: env.ADMIN_NAME ?? demoFixtures.admin.name,
    timezone: env.TENANT_TIMEZONE ?? demoFixtures.tenantTimezone,
    demoManagerPassword: demoFixtures.demoManagerPassword,
    demoManagers: demoFixtures.demoManagers,
  }
}

export function assertSeedExecutionAllowed(env: NodeJS.ProcessEnv = process.env) {
  const nodeEnv = resolveNodeEnv(env.NODE_ENV)
  if (isSafeEnv(nodeEnv)) {
    return
  }

  if (env[SEED_UNSAFE_ENV_ACK]?.trim().toLowerCase() === 'true') {
    return
  }

  throw new Error(
    `Refusing to run seed in NODE_ENV=${nodeEnv} without ${SEED_UNSAFE_ENV_ACK}=true. Use the explicit bootstrap seed command.`,
  )
}

export function requireSeedWebhookSecret(env: NodeJS.ProcessEnv = process.env) {
  const nodeEnv = resolveNodeEnv(env.NODE_ENV)
  const secret = normalizeSecret(env.SALESOS_WEBHOOK_SECRET)

  if (secret) {
    if (!isSafeEnv(nodeEnv) && isDefaultSecret(secret)) {
      throw new Error(`SALESOS_WEBHOOK_SECRET must be changed outside development/test (NODE_ENV=${nodeEnv})`)
    }
    return secret
  }

  if (isSafeEnv(nodeEnv)) {
    return DEFAULT_INSECURE_SECRET
  }

  throw new Error(`SALESOS_WEBHOOK_SECRET is required outside development/test (NODE_ENV=${nodeEnv})`)
}
