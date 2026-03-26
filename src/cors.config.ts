import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface'

const DEFAULT_DEV_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000']

function normalizeOrigin(origin: string) {
  return new URL(origin).origin
}

function readOriginValues(value: string | undefined) {
  if (!value) {
    return []
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function getAllowedCorsOrigins(env: NodeJS.ProcessEnv = process.env) {
  const configuredOrigins = [
    ...readOriginValues(env.CORS_ALLOWED_ORIGINS),
    env.FRONTEND_URL,
    env.APP_URL,
    env.NEXT_PUBLIC_APP_URL,
  ].filter((value): value is string => Boolean(value))

  const allOrigins = env.NODE_ENV === 'production' ? configuredOrigins : [...configuredOrigins, ...DEFAULT_DEV_ORIGINS]

  return [...new Set(allOrigins.map(normalizeOrigin))]
}

export function createCorsOptions(env: NodeJS.ProcessEnv = process.env): CorsOptions {
  const allowedOrigins = getAllowedCorsOrigins(env)

  if (allowedOrigins.length === 0) {
    throw new Error('CORS allowed origins are not configured')
  }

  return {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true)
        return
      }

      try {
        if (allowedOrigins.includes(normalizeOrigin(origin))) {
          callback(null, true)
          return
        }
      } catch {
        callback(new Error(`Origin ${origin} is invalid`), false)
        return
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS`), false)
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Accept', 'Authorization', 'Content-Type'],
  }
}
