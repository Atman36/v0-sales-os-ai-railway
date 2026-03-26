import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

export const TOKEN_REVOCATION_STORE = Symbol('TOKEN_REVOCATION_STORE')

export type TokenRevocationBackend = 'memory' | 'database'

type Awaitable<T> = T | Promise<T>

export interface TokenRevocationStore {
  revoke(tokenHash: string, expiresAt: number, now?: number): Awaitable<void>
  isRevoked(tokenHash: string, now?: number): Awaitable<boolean>
  cleanup(now?: number): Awaitable<void>
}

export function resolveTokenRevocationBackend(value?: string | null): TokenRevocationBackend {
  const normalizedValue = value?.trim().toLowerCase()

  if (!normalizedValue || normalizedValue === 'memory') {
    return 'memory'
  }

  if (
    normalizedValue === 'database' ||
    normalizedValue === 'db' ||
    normalizedValue === 'prisma'
  ) {
    return 'database'
  }

  throw new Error(
    `Unsupported AUTH_TOKEN_REVOCATION_BACKEND: "${value}". Supported backends: memory, database.`,
  )
}

@Injectable()
export class InMemoryTokenRevocationStore implements TokenRevocationStore {
  private readonly revokedTokens = new Map<string, number>()

  async revoke(tokenHash: string, expiresAt: number, now = Date.now()) {
    await this.cleanup(now)
    this.revokedTokens.set(tokenHash, expiresAt)
  }

  async isRevoked(tokenHash: string, now = Date.now()) {
    await this.cleanup(now)

    const expiresAt = this.revokedTokens.get(tokenHash)
    if (!expiresAt) {
      return false
    }

    if (expiresAt <= now) {
      this.revokedTokens.delete(tokenHash)
      return false
    }

    return true
  }

  async cleanup(now = Date.now()) {
    for (const [tokenHash, expiresAt] of this.revokedTokens.entries()) {
      if (expiresAt <= now) {
        this.revokedTokens.delete(tokenHash)
      }
    }
  }
}

@Injectable()
export class PrismaTokenRevocationStore implements TokenRevocationStore {
  constructor(private readonly prisma: PrismaService) {}

  async revoke(tokenHash: string, expiresAt: number, now = Date.now()) {
    await this.cleanup(now)
    await this.prisma.revokedAccessToken.upsert({
      where: { tokenHash },
      create: {
        tokenHash,
        expiresAt: new Date(expiresAt),
      },
      update: {
        expiresAt: new Date(expiresAt),
      },
    })
  }

  async isRevoked(tokenHash: string, now = Date.now()) {
    const entry = await this.prisma.revokedAccessToken.findUnique({
      where: { tokenHash },
      select: { expiresAt: true },
    })

    if (!entry) {
      return false
    }

    if (entry.expiresAt.getTime() <= now) {
      await this.prisma.revokedAccessToken.deleteMany({
        where: {
          tokenHash,
          expiresAt: { lte: new Date(now) },
        },
      })
      return false
    }

    return true
  }

  async cleanup(now = Date.now()) {
    await this.prisma.revokedAccessToken.deleteMany({
      where: {
        expiresAt: { lte: new Date(now) },
      },
    })
  }
}
