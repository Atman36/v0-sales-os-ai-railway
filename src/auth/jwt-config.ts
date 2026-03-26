import { isDefaultSecret, normalizeSecret, resolveNodeEnv, isSafeEnv } from '@shared/runtime-env'

export function requireJwtSecret(
  secret = process.env.JWT_SECRET,
  nodeEnv = process.env.NODE_ENV,
) {
  const normalizedSecret = normalizeSecret(secret)
  const resolvedNodeEnv = resolveNodeEnv(nodeEnv)

  if (!normalizedSecret) {
    throw new Error('JWT_SECRET is required')
  }

  if (!isSafeEnv(resolvedNodeEnv) && isDefaultSecret(normalizedSecret)) {
    throw new Error(`JWT_SECRET must be changed outside development/test (NODE_ENV=${resolvedNodeEnv})`)
  }

  return normalizedSecret
}
