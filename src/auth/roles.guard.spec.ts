import { Reflector } from '@nestjs/core'
import { RolesGuard } from './roles.guard'
import { ROLES_KEY } from './roles.decorator'

describe('RolesGuard', () => {
  function createContext(user?: { role?: string }) {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as any
  }

  it('allows access when RolesGuard is used without @Roles metadata', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector

    const guard = new RolesGuard(reflector)

    expect(guard.canActivate(createContext({ role: 'admin' }))).toBe(true)
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, expect.any(Array))
  })

  it('allows access when @Roles metadata is an empty list', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([]),
    } as unknown as Reflector

    const guard = new RolesGuard(reflector)

    expect(guard.canActivate(createContext({ role: 'admin' }))).toBe(true)
  })

  it('allows access for a matching role', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['admin']),
    } as unknown as Reflector

    const guard = new RolesGuard(reflector)

    expect(guard.canActivate(createContext({ role: 'admin' }))).toBe(true)
  })

  it('denies access when route requires roles and request has no user', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['admin']),
    } as unknown as Reflector

    const guard = new RolesGuard(reflector)

    expect(guard.canActivate(createContext())).toBe(false)
  })

  it('denies access when route requires roles and user has no role', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['admin']),
    } as unknown as Reflector

    const guard = new RolesGuard(reflector)

    expect(guard.canActivate(createContext({}))).toBe(false)
  })

  it('denies access for a non-matching role', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['admin']),
    } as unknown as Reflector

    const guard = new RolesGuard(reflector)

    expect(guard.canActivate(createContext({ role: 'manager' }))).toBe(false)
  })
})
