import { ForbiddenException } from '@nestjs/common'
import {
  requireManagerAccess,
  requireManagerId,
  requireRopAccess,
  resolveInsightsScope,
  type CurrentAuthUser,
} from './access-control'

describe('access-control', () => {
  const ropUser: CurrentAuthUser = {
    sub: 'rop-1',
    email: 'rop@example.com',
    role: 'admin',
    managerId: null,
  }

  const managerUser: CurrentAuthUser = {
    sub: 'manager-user-1',
    email: 'manager@example.com',
    role: 'user',
    managerId: 'manager-1',
  }

  it('allows only ROP users through the elevated access helper', () => {
    expect(() => requireRopAccess(ropUser)).not.toThrow()
    expect(() => requireRopAccess(managerUser)).toThrow(ForbiddenException)
  })

  it('requires manager binding for manager-scoped endpoints', () => {
    expect(requireManagerId(managerUser)).toBe('manager-1')
    expect(() => requireManagerId(ropUser)).toThrow(ForbiddenException)
  })

  it('keeps ROP access unrestricted while managers stay bound to their own managerId', () => {
    expect(requireManagerAccess(ropUser, 'manager-2')).toBe('manager-2')
    expect(requireManagerAccess(managerUser, 'manager-1')).toBe('manager-1')
    expect(() => requireManagerAccess(managerUser, 'manager-2')).toThrow(ForbiddenException)
  })

  it('keeps TEAM insights available only to ROP and downgrades managers to their own scope', () => {
    expect(resolveInsightsScope(ropUser, 'TEAM')).toEqual({ scope: 'TEAM', managerId: undefined })
    expect(resolveInsightsScope(ropUser, 'MANAGER', 'manager-2')).toEqual({
      scope: 'MANAGER',
      managerId: 'manager-2',
    })

    expect(resolveInsightsScope(managerUser, undefined)).toEqual({
      scope: 'MANAGER',
      managerId: 'manager-1',
    })

    expect(resolveInsightsScope(managerUser, 'MANAGER', 'manager-1')).toEqual({
      scope: 'MANAGER',
      managerId: 'manager-1',
    })

    expect(() => resolveInsightsScope(managerUser, 'TEAM')).toThrow(ForbiddenException)
    expect(() => resolveInsightsScope(managerUser, 'MANAGER', 'manager-2')).toThrow(ForbiddenException)
  })
})
