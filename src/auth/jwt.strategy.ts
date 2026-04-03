import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import type { Request } from 'express'
import { createJwtStrategyOptions } from './jwt-config'
import { TokenRevocationService } from './token-revocation.service'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(TokenRevocationService)
    private readonly tokenRevocationService: TokenRevocationService,
  ) {
    super(createJwtStrategyOptions(config.get<string>('JWT_SECRET'), config.get<string>('NODE_ENV')))
  }

  async validate(
    req: Request,
    payload: { sub: string; email: string; role: string; name?: string; managerId?: string | null },
  ) {
    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req)
    if (token && (await this.tokenRevocationService.isRevoked(token))) {
      throw new UnauthorizedException('Token has been revoked')
    }

    return payload
  }
}
