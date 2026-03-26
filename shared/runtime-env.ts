const SAFE_NODE_ENVS = new Set(['development', 'test'])

export const DEFAULT_INSECURE_SECRET = 'change-me'

export function resolveNodeEnv(
  nodeEnv: string | null | undefined,
  defaultNodeEnv = 'development',
): string {
  return nodeEnv?.trim() || defaultNodeEnv
}

export function isSafeEnv(
  nodeEnv: string | null | undefined,
  defaultNodeEnv = 'development',
): boolean {
  return SAFE_NODE_ENVS.has(resolveNodeEnv(nodeEnv, defaultNodeEnv))
}

export function normalizeSecret(secret: string | null | undefined): string | null {
  const normalized = secret?.trim()
  return normalized ? normalized : null
}

export function isDefaultSecret(secret: string | null | undefined): boolean {
  return normalizeSecret(secret) === DEFAULT_INSECURE_SECRET
}
