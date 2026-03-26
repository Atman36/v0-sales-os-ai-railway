import { Body, Controller, Get, HttpCode, Inject, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common'
import { Throttle, ThrottlerGuard } from '@nestjs/throttler'
import { ExtractJwt } from 'passport-jwt'
import type { Request } from 'express'
import {
  AuthLoginRequestSchema,
  PasswordResetConfirmSchema,
  PasswordResetRequestSchema,
} from '@shared/schemas'
import { AuthService } from './auth.service'
import { JwtAuthGuard } from './jwt-auth.guard'
import { CurrentUser } from './current-user.decorator'
import { parseOrThrow } from '../utils/validation'

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post('login')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60 } })
  async login(@Body() body: unknown) {
    const payload = parseOrThrow(AuthLoginRequestSchema, body)
    return this.authService.login(payload.login ?? payload.email ?? '', payload.password)
  }

  @Post('password-reset/request')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60 } })
  async requestPasswordReset(@Body() body: unknown) {
    const payload = parseOrThrow(PasswordResetRequestSchema, body)
    return this.authService.requestPasswordReset(payload.email)
  }

  @Post('password-reset/confirm')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60 } })
  async confirmPasswordReset(@Body() body: unknown) {
    const payload = parseOrThrow(PasswordResetConfirmSchema, body)
    await this.authService.confirmPasswordReset(payload.token, payload.password)
    return { ok: true as const }
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() user: { sub: string; email: string; role: string; name?: string; managerId?: string | null }) {
    return {
      id: user.sub,
      email: user.email,
      role: user.role,
      name: user.name ?? 'User',
      managerId: user.managerId ?? null,
    }
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  async logout(@Req() request: Request) {
    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(request)
    if (!token) {
      throw new UnauthorizedException('Unauthorized')
    }

    await this.authService.logout(token)
  }
}
