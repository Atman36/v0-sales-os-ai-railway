import {
  isAuthHidden,
  isDemoModeEnabled,
  validatePublicRuntimeConfig,
} from '../../../../lib/auth-config'

describe('isDemoModeEnabled', () => {
  it('keeps demo mode disabled by default when NEXT_PUBLIC_ENABLE_DEMO_MOCKS is unset', () => {
    expect(isDemoModeEnabled(undefined)).toBe(false)
  })

  it('enables demo mode only when NEXT_PUBLIC_ENABLE_DEMO_MOCKS is true', () => {
    expect(isDemoModeEnabled('true')).toBe(true)
    expect(isDemoModeEnabled('false')).toBe(false)
  })

  it('rejects demo mode in preview env', () => {
    expect(() => isDemoModeEnabled('true', 'preview')).toThrow(
      '- NEXT_PUBLIC_ENABLE_DEMO_MOCKS=true is not allowed outside development/test.',
    )
  })
})

describe('isAuthHidden', () => {
  it('keeps auth visible by default when NEXT_PUBLIC_AUTH_HIDDEN is unset', () => {
    expect(isAuthHidden(undefined)).toBe(false)
  })

  it('keeps auth visible when NEXT_PUBLIC_AUTH_HIDDEN is false', () => {
    expect(isAuthHidden('false')).toBe(false)
  })

  it('hides auth only when NEXT_PUBLIC_AUTH_HIDDEN is true', () => {
    expect(isAuthHidden('true', 'development', true)).toBe(true)
  })

  it('rejects hidden auth in stage env', () => {
    expect(() => isAuthHidden('true', 'stage')).toThrow(
      '- NEXT_PUBLIC_AUTH_HIDDEN=true is not allowed outside development/test.',
    )
  })

  it('requires demo mode for hidden auth', () => {
    expect(() => isAuthHidden('true', 'development', false)).toThrow(
      '- NEXT_PUBLIC_AUTH_HIDDEN=true requires NEXT_PUBLIC_ENABLE_DEMO_MOCKS=true.',
    )
  })

  it('allows hidden auth when demo mode is explicitly enabled', () => {
    expect(isAuthHidden('true', 'development', true)).toBe(true)
  })
})

describe('validatePublicRuntimeConfig', () => {
  it('normalizes demo/auth flags for local development', () => {
    expect(
      validatePublicRuntimeConfig({
        NODE_ENV: 'development',
        NEXT_PUBLIC_ENABLE_DEMO_MOCKS: 'true',
        NEXT_PUBLIC_AUTH_HIDDEN: 'true',
      }),
    ).toEqual({
      nodeEnv: 'development',
      demoModeEnabled: true,
      authHidden: true,
    })
  })

  it('treats build validation as production when NODE_ENV is missing', () => {
    expect(() =>
      validatePublicRuntimeConfig(
        {
          NEXT_PUBLIC_ENABLE_DEMO_MOCKS: 'true',
          NEXT_PUBLIC_AUTH_HIDDEN: 'false',
        },
        { context: 'build', defaultNodeEnv: 'production' },
      ),
    ).toThrow(
      [
        'Invalid public runtime configuration for build.',
        'NODE_ENV resolved to "production".',
        '- NEXT_PUBLIC_ENABLE_DEMO_MOCKS=true is not allowed outside development/test.',
        'Disable NEXT_PUBLIC_ENABLE_DEMO_MOCKS and NEXT_PUBLIC_AUTH_HIDDEN outside development/test.',
      ].join('\n'),
    )
  })

  it('reports all invalid deployment-env demo flags in one error', () => {
    expect(() =>
      validatePublicRuntimeConfig(
        {
          NODE_ENV: 'preview',
          NEXT_PUBLIC_ENABLE_DEMO_MOCKS: 'true',
          NEXT_PUBLIC_AUTH_HIDDEN: 'true',
        },
        { context: 'runtime' },
      ),
    ).toThrow(
      [
        'Invalid public runtime configuration for runtime.',
        'NODE_ENV resolved to "preview".',
        '- NEXT_PUBLIC_ENABLE_DEMO_MOCKS=true is not allowed outside development/test.',
        '- NEXT_PUBLIC_AUTH_HIDDEN=true is not allowed outside development/test.',
        'Disable NEXT_PUBLIC_ENABLE_DEMO_MOCKS and NEXT_PUBLIC_AUTH_HIDDEN outside development/test.',
      ].join('\n'),
    )
  })
})
