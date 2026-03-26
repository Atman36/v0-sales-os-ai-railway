import { createHash } from 'crypto'
import { Inject, Injectable } from '@nestjs/common'
import { TOKEN_REVOCATION_STORE, type TokenRevocationStore } from './token-revocation.store'

const DEFAULT_REVOCATION_TTL_MS = 12 * 60 * 60 * 1000

type JwtPayload = {
  exp?: unknown
}

function decodeTokenPayload(token: string): JwtPayload | null {
  const [, payload] = token.split('.')
  if (!payload) {
    return null
  }

  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as JwtPayload
  } catch {
    return null
  }
}

@Injectable()
export class TokenRevocationService {
  constructor(
    @Inject(TOKEN_REVOCATION_STORE)
    private readonly tokenRevocationStore: TokenRevocationStore,
  ) {}

  async revoke(token: string, now = Date.now()) {
    await this.tokenRevocationStore.revoke(
      this.hashToken(token),
      this.resolveExpiresAt(token, now),
      now,
    )
  }

  async isRevoked(token: string, now = Date.now()) {
    return this.tokenRevocationStore.isRevoked(this.hashToken(token), now)
  }

  async cleanup(now = Date.now()) {
    await this.tokenRevocationStore.cleanup(now)
  }

  private resolveExpiresAt(token: string, now: number) {
    const payload = decodeTokenPayload(token)
    if (typeof payload?.exp === 'number' && Number.isFinite(payload.exp)) {
      return payload.exp * 1000
    }

    return now + DEFAULT_REVOCATION_TTL_MS
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex')
  }
}
