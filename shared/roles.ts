import { z } from 'zod'
import { UserRoleSchema, type UserRole } from './schemas'

export const BusinessRoleSchema = z.enum(['ROP', 'MANAGER'])
export type BusinessRole = z.infer<typeof BusinessRoleSchema>

export const PrismaUserRoleSchema = z.enum(['ADMIN', 'USER'])
export type PrismaUserRole = z.infer<typeof PrismaUserRoleSchema>

type NormalizableUserRole = UserRole | PrismaUserRole
type RoleSubject = NormalizableUserRole | { role: NormalizableUserRole }

const BUSINESS_ROLE_BY_USER_ROLE: Record<UserRole, BusinessRole> = {
  admin: 'ROP',
  user: 'MANAGER',
}

const USER_ROLE_BY_BUSINESS_ROLE: Record<BusinessRole, UserRole> = {
  ROP: 'admin',
  MANAGER: 'user',
}

const USER_ROLE_LABELS: Record<BusinessRole, string> = {
  ROP: 'РОП',
  MANAGER: 'Менеджер',
}

function readRoleValue(subject: RoleSubject) {
  return typeof subject === 'string' ? subject : subject.role
}

export function isUserRole(value: unknown): value is UserRole {
  return UserRoleSchema.safeParse(value).success
}

export function isBusinessRole(value: unknown): value is BusinessRole {
  return BusinessRoleSchema.safeParse(value).success
}

export function normalizeUserRole(value: unknown): UserRole | null {
  if (typeof value !== 'string') {
    return null
  }

  if (isUserRole(value)) {
    return value
  }

  if (PrismaUserRoleSchema.safeParse(value).success) {
    return value === 'ADMIN' ? 'admin' : 'user'
  }

  return null
}

export function toBusinessRole(subject: RoleSubject): BusinessRole {
  const role = normalizeUserRole(readRoleValue(subject))
  if (!role) {
    throw new Error('Invalid user role')
  }

  return BUSINESS_ROLE_BY_USER_ROLE[role]
}

export function toUserRole(role: BusinessRole): UserRole {
  return USER_ROLE_BY_BUSINESS_ROLE[role]
}

export function hasBusinessRole(subject: RoleSubject | null | undefined, role: BusinessRole): boolean {
  if (!subject) {
    return false
  }

  const normalizedRole = normalizeUserRole(readRoleValue(subject))
  return normalizedRole ? BUSINESS_ROLE_BY_USER_ROLE[normalizedRole] === role : false
}

export function isRop(subject: RoleSubject | null | undefined): boolean {
  return hasBusinessRole(subject, 'ROP')
}

export function isManager(subject: RoleSubject | null | undefined): boolean {
  return hasBusinessRole(subject, 'MANAGER')
}

export function getBusinessRoleLabel(subject: BusinessRole | RoleSubject): string {
  const role = isBusinessRole(subject) ? subject : toBusinessRole(subject)
  return USER_ROLE_LABELS[role]
}
