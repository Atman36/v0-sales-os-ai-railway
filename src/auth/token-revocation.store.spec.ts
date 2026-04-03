import {
  InMemoryTokenRevocationStore,
  PrismaTokenRevocationStore,
  type TokenRevocationStore,
} from './token-revocation.store'

function createPrismaRevokedAccessTokenDelegate() {
  const entries = new Map<
    string,
    {
      tokenHash: string
      expiresAt: Date
      createdAt: Date
    }
  >()

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
      const existing = entries.get(where.tokenHash)
      const nextEntry = {
        tokenHash: where.tokenHash,
        expiresAt: existing ? update.expiresAt : create.expiresAt,
        createdAt: existing?.createdAt ?? new Date(0),
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

function runTokenRevocationStoreContract(
  name: string,
  createStore: () => TokenRevocationStore,
) {
  describe(name, () => {
    it('blocks a revoked token hash until the configured expiry', async () => {
      const store = createStore()
      const now = new Date('2026-03-23T10:00:00.000Z').getTime()

      await store.revoke('hash-1', now + 60_000, now)

      await expect(store.isRevoked('hash-1', now + 1_000)).resolves.toBe(true)
      await expect(store.isRevoked('hash-1', now + 61_000)).resolves.toBe(false)
    })

    it('supports cleanup semantics without touching still-valid entries', async () => {
      const store = createStore()
      const now = new Date('2026-03-23T10:00:00.000Z').getTime()

      await store.revoke('expired-hash', now + 1_000, now)
      await store.revoke('active-hash', now + 120_000, now)

      await store.cleanup(now + 1_500)

      await expect(store.isRevoked('expired-hash', now + 1_500)).resolves.toBe(false)
      await expect(store.isRevoked('active-hash', now + 1_500)).resolves.toBe(true)
    })
  })
}

describe('TokenRevocationStore contract', () => {
  runTokenRevocationStoreContract('InMemoryTokenRevocationStore', () => new InMemoryTokenRevocationStore())

  runTokenRevocationStoreContract('PrismaTokenRevocationStore', () => {
    return new PrismaTokenRevocationStore({
      revokedAccessToken: createPrismaRevokedAccessTokenDelegate(),
    } as any)
  })
})

describe('PrismaTokenRevocationStore', () => {
  it('persists revocations across store instances backed by the same database table', async () => {
    const revokedAccessToken = createPrismaRevokedAccessTokenDelegate()
    const writerStore = new PrismaTokenRevocationStore({ revokedAccessToken } as any)
    const readerStore = new PrismaTokenRevocationStore({ revokedAccessToken } as any)
    const now = new Date('2026-03-23T10:00:00.000Z').getTime()

    await writerStore.revoke('hash-1', now + 60_000, now)

    await expect(readerStore.isRevoked('hash-1', now + 1_000)).resolves.toBe(true)
    await expect(readerStore.isRevoked('hash-1', now + 61_000)).resolves.toBe(false)
  })
})
