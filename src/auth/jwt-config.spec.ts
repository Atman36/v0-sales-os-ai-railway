import {
  createJwtModuleOptions,
  createJwtStrategyOptions,
  requireJwtSecret,
} from './jwt-config'

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

describe('createJwtModuleOptions', () => {
  it('pins the signing algorithm for issued access tokens', () => {
    expect(createJwtModuleOptions('super-secret', 'production')).toEqual({
      secret: 'super-secret',
      signOptions: {
        expiresIn: '12h',
        algorithm: 'HS256',
      },
    })
  })
})

describe('createJwtStrategyOptions', () => {
  it('pins accepted verification algorithms for bearer tokens', () => {
    const options = createJwtStrategyOptions('super-secret', 'production')

    expect((options as { secretOrKey: string }).secretOrKey).toBe('super-secret')
    expect(options.ignoreExpiration).toBe(false)
    expect(options.passReqToCallback).toBe(true)
    expect(options.algorithms).toEqual(['HS256'])
    expect(typeof options.jwtFromRequest).toBe('function')
  })
})
