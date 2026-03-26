import { requireJwtSecret } from './jwt-config'

describe('requireJwtSecret', () => {
  it('returns a configured JWT secret', () => {
    expect(requireJwtSecret('super-secret')).toBe('super-secret')
  })

  it('rejects missing JWT secret', () => {
    expect(() => requireJwtSecret(undefined)).toThrow('JWT_SECRET is required')
  })

  it('rejects blank JWT secret', () => {
    expect(() => requireJwtSecret('   ')).toThrow('JWT_SECRET is required')
  })

  it('rejects the default placeholder secret in preview env', () => {
    expect(() => requireJwtSecret('change-me', 'preview')).toThrow(
      'JWT_SECRET must be changed outside development/test (NODE_ENV=preview)',
    )
  })
})
