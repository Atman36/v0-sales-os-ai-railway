import { ForbiddenException } from '@nestjs/common'
import { isRop, normalizeUserRole } from '@shared/roles'

export type CurrentAuthUser = {
  sub: string
  email: string
  role: string
  name?: string
  managerId?: string | null
}

function getUserRoleOrThrow(user: CurrentAuthUser) {
  const role = normalizeUserRole(user.role)
  if (!role) {
    throw new ForbiddenException('Access denied')
  }

  return role
}

export function requireRopAccess(user: CurrentAuthUser) {
  if (!isRop(getUserRoleOrThrow(user))) {
    throw new ForbiddenException('Access denied')
  }
}

export function requireManagerId(user: CurrentAuthUser) {
  if (!user.managerId) {
    throw new ForbiddenException('Manager context is required')
  }

  return user.managerId
}

export function requireManagerAccess(user: CurrentAuthUser, requestedManagerId: string) {
  if (isRop(getUserRoleOrThrow(user))) {
    return requestedManagerId
  }

  const managerId = requireManagerId(user)
  if (managerId !== requestedManagerId) {
    throw new ForbiddenException('Access denied')
  }

  return managerId
}

export function resolveInsightsScope(
  user: CurrentAuthUser,
  scope?: 'TEAM' | 'MANAGER',
  requestedManagerId?: string,
) {
  if (isRop(getUserRoleOrThrow(user))) {
    return {
      scope,
      managerId: requestedManagerId,
    }
  }

  if (scope === 'TEAM') {
    throw new ForbiddenException('Access denied')
  }

  const managerId = requireManagerId(user)
  if (requestedManagerId && requestedManagerId !== managerId) {
    throw new ForbiddenException('Access denied')
  }

  return {
    scope: 'MANAGER' as const,
    managerId,
  }
}
