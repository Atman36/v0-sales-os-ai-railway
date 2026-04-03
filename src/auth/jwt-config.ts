import { isDefaultSecret, normalizeSecret, resolveNodeEnv, isSafeEnv } from '@shared/runtime-env'
import type { JwtModuleOptions } from '@nestjs/jwt'
import type { Algorithm } from 'jsonwebtoken'
import { ExtractJwt } from 'passport-jwt'
import type { StrategyOptionsWithRequest } from 'passport-jwt'

export const JWT_ACCESS_TOKEN_TTL = '12h'
export const JWT_SIGNING_ALGORITHM: Algorithm = 'HS256'
export const JWT_ALLOWED_ALGORITHMS = [JWT_SIGNING_ALGORITHM] as const

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

export function createJwtModuleOptions(
  secret = process.env.JWT_SECRET,
  nodeEnv = process.env.NODE_ENV,
): JwtModuleOptions {
  return {
    secret: requireJwtSecret(secret, nodeEnv),
    signOptions: {
      expiresIn: JWT_ACCESS_TOKEN_TTL,
      algorithm: JWT_SIGNING_ALGORITHM,
    },
  }
}

export function createJwtStrategyOptions(
  secret = process.env.JWT_SECRET,
  nodeEnv = process.env.NODE_ENV,
): StrategyOptionsWithRequest {
  return {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    ignoreExpiration: false,
    secretOrKey: requireJwtSecret(secret, nodeEnv),
    passReqToCallback: true,
    algorithms: [...JWT_ALLOWED_ALGORITHMS],
  }
}
