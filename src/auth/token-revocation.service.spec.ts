import { TokenRevocationService } from './token-revocation.service'
import { InMemoryTokenRevocationStore, PrismaTokenRevocationStore } from './token-revocation.store'

function createUnsignedToken(payload: Record<string, unknown>) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `header.${encodedPayload}.signature`
}

function createPrismaRevokedAccessTokenDelegate() {
  const entries = new Map<string, { tokenHash: string; expiresAt: Date }>()

  return {
    async upsert({
      where,
      create,
      update,
    }: {
      where: { tokenHash: string }
      create: { tokenHash: string; expiresAt: Date }
      update: { expiresAt: Date }
    }) {
      const nextEntry = {
        tokenHash: where.tokenHash,
        expiresAt: entries.has(where.tokenHash) ? update.expiresAt : create.expiresAt,
      }

      entries.set(where.tokenHash, nextEntry)
      return nextEntry
    },

    async findUnique({ where }: { where: { tokenHash: string } }) {
      return entries.get(where.tokenHash) ?? null
    },

    async delete({ where }: { where: { tokenHash: string } }) {
      entries.delete(where.tokenHash)
    },

    async deleteMany({
      where,
    }: {
      where?: {
        tokenHash?: string
        expiresAt?: { lte: Date }
      }
    }) {
      let count = 0

      for (const [tokenHash, entry] of entries.entries()) {
        const matchesTokenHash = !where?.tokenHash || where.tokenHash === tokenHash
        const matchesExpiry = !where?.expiresAt || entry.expiresAt <= where.expiresAt.lte

        if (matchesTokenHash && matchesExpiry) {
          entries.delete(tokenHash)
          count += 1
        }
      }

      return { count }
    },
  }
}

describe('TokenRevocationService', () => {
  it('marks a revoked token as blocked until its jwt expiry', async () => {
    const service = new TokenRevocationService(new InMemoryTokenRevocationStore())
    const now = new Date('2026-03-23T10:00:00.000Z').getTime()
    const expiresAt = Math.floor((now + 60_000) / 1000)
    const token = createUnsignedToken({ exp: expiresAt })

    await service.revoke(token, now)

    await expect(service.isRevoked(token, now + 1_000)).resolves.toBe(true)
    await expect(service.isRevoked(token, now + 61_000)).resolves.toBe(false)
  })

  it('falls back to a default ttl when the token has no exp claim', async () => {
    const service = new TokenRevocationService(new InMemoryTokenRevocationStore())
    const now = new Date('2026-03-23T10:00:00.000Z').getTime()
    const token = createUnsignedToken({ sub: 'user-1' })

    await service.revoke(token, now)

    await expect(service.isRevoked(token, now + 1000)).resolves.toBe(true)
    await expect(service.isRevoked(token, now + 12 * 60 * 60 * 1000 + 1)).resolves.toBe(false)
  })

  it('keeps a logout revocation durable across service instances when database backend is used', async () => {
    const revokedAccessToken = createPrismaRevokedAccessTokenDelegate()
    const writer = new TokenRevocationService(
      new PrismaTokenRevocationStore({ revokedAccessToken } as any),
    )
    const reader = new TokenRevocationService(
      new PrismaTokenRevocationStore({ revokedAccessToken } as any),
    )
    const now = new Date('2026-03-23T10:00:00.000Z').getTime()
    const expiresAt = Math.floor((now + 60_000) / 1000)
    const token = createUnsignedToken({ exp: expiresAt })

    await writer.revoke(token, now)

    await expect(reader.isRevoked(token, now + 1_000)).resolves.toBe(true)
    await expect(reader.isRevoked(token, now + 61_000)).resolves.toBe(false)
  })
})
