import { isSafeEnv } from '@shared/runtime-env'

describe('isSafeEnv', () => {
  it('treats development as safe', () => {
    expect(isSafeEnv('development')).toBe(true)
  })

  it('treats test as safe', () => {
    expect(isSafeEnv('test')).toBe(true)
  })

  it('treats stage-like envs as deployment envs', () => {
    expect(isSafeEnv('preview')).toBe(false)
    expect(isSafeEnv('stage')).toBe(false)
    expect(isSafeEnv('production')).toBe(false)
  })
})
