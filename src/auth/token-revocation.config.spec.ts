import {
  assertTokenRevocationBackendConfigured,
  resolveTokenRevocationBackend,
} from './token-revocation.config'

describe('resolveTokenRevocationBackend', () => {
  it('defaults to memory in local development when the backend is unset', () => {
    expect(resolveTokenRevocationBackend(undefined)).toBe('memory')
  })

  it('defaults to database in deployment-like envs when the backend is unset', () => {
    expect(resolveTokenRevocationBackend(undefined, 'preview')).toBe('database')
    expect(resolveTokenRevocationBackend(undefined, 'production')).toBe('database')
  })

  it('accepts the in-memory backend explicitly', () => {
    expect(resolveTokenRevocationBackend(' memory ')).toBe('memory')
  })

  it('rejects the in-memory backend outside development/test', () => {
    expect(() => resolveTokenRevocationBackend('memory', 'production')).toThrow(
      'AUTH_TOKEN_REVOCATION_BACKEND=memory is not allowed outside development/test (NODE_ENV=production). Use AUTH_TOKEN_REVOCATION_BACKEND=database for durable logout.',
    )
  })

  it('accepts the database backend for deployment environments', () => {
    expect(resolveTokenRevocationBackend(' database ')).toBe('database')
  })

  it('rejects unsupported backends', () => {
    expect(() => resolveTokenRevocationBackend('redis')).toThrow(
      'Unsupported AUTH_TOKEN_REVOCATION_BACKEND: "redis". Supported backends: memory, database.',
    )
  })
})

describe('assertTokenRevocationBackendConfigured', () => {
  it('fails startup validation for memory-backed revocation outside local development', () => {
    expect(() => assertTokenRevocationBackendConfigured('memory', 'stage')).toThrow(
      'AUTH_TOKEN_REVOCATION_BACKEND=memory is not allowed outside development/test (NODE_ENV=stage). Use AUTH_TOKEN_REVOCATION_BACKEND=database for durable logout.',
    )
  })
})
