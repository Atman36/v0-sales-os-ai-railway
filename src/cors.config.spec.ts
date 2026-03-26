import { createCorsOptions, getAllowedCorsOrigins } from './cors.config'

describe('cors.config', () => {
  it('allows localhost frontend origins in non-production environments', () => {
    expect(getAllowedCorsOrigins({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)).toEqual([
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ])
  })

  it('merges configured origins and normalizes duplicates', () => {
    const origins = getAllowedCorsOrigins({
      NODE_ENV: 'production',
      CORS_ALLOWED_ORIGINS: 'https://app.salesos.ai, https://app.salesos.ai/',
      FRONTEND_URL: 'https://stage.salesos.ai',
      NEXT_PUBLIC_APP_URL: 'https://stage.salesos.ai/app',
    } as NodeJS.ProcessEnv)

    expect(origins).toEqual(['https://app.salesos.ai', 'https://stage.salesos.ai'])
  })

  it('rejects empty production configuration', () => {
    expect(() => createCorsOptions({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toThrow(
      'CORS allowed origins are not configured',
    )
  })

  it('accepts configured origins and blocks unknown ones', () => {
    const options = createCorsOptions({
      NODE_ENV: 'production',
      CORS_ALLOWED_ORIGINS: 'https://app.salesos.ai',
    } as NodeJS.ProcessEnv)
    const originHandler = options.origin

    if (typeof originHandler !== 'function') {
      throw new Error('Expected CORS origin handler to be a function')
    }

    const allowed = jest.fn()
    originHandler('https://app.salesos.ai', allowed)
    expect(allowed).toHaveBeenCalledWith(null, true)

    const blocked = jest.fn()
    originHandler('https://evil.example', blocked)
    expect(blocked.mock.calls[0]?.[0]).toBeInstanceOf(Error)
    expect(blocked.mock.calls[0]?.[1]).toBe(false)
  })
})
