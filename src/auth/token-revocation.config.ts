import { isSafeEnv, resolveNodeEnv } from '@shared/runtime-env'

export type TokenRevocationBackend = 'memory' | 'database'

const MEMORY_ONLY_BACKEND_ERROR = (resolvedNodeEnv: string) =>
  `AUTH_TOKEN_REVOCATION_BACKEND=memory is not allowed outside development/test (NODE_ENV=${resolvedNodeEnv}). Use AUTH_TOKEN_REVOCATION_BACKEND=database for durable logout.`

export function resolveTokenRevocationBackend(
  value?: string | null,
  nodeEnv = process.env.NODE_ENV,
): TokenRevocationBackend {
  const normalizedValue = value?.trim().toLowerCase()
  const resolvedNodeEnv = resolveNodeEnv(nodeEnv)

  if (!normalizedValue) {
    return isSafeEnv(resolvedNodeEnv) ? 'memory' : 'database'
  }

  if (normalizedValue === 'memory') {
    if (!isSafeEnv(resolvedNodeEnv)) {
      throw new Error(MEMORY_ONLY_BACKEND_ERROR(resolvedNodeEnv))
    }

    return 'memory'
  }

  if (
    normalizedValue === 'database' ||
    normalizedValue === 'db' ||
    normalizedValue === 'prisma'
  ) {
    return 'database'
  }

  throw new Error(
    `Unsupported AUTH_TOKEN_REVOCATION_BACKEND: "${value}". Supported backends: memory, database.`,
  )
}

export function assertTokenRevocationBackendConfigured(
  value?: string | null,
  nodeEnv = process.env.NODE_ENV,
) {
  resolveTokenRevocationBackend(value, nodeEnv)
}
