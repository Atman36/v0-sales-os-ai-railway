import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { isManager, normalizeUserRole } from '@shared/roles'
import { isSafeEnv } from '@shared/runtime-env'
import bcrypt from 'bcryptjs'
import { createHash, randomBytes } from 'crypto'
import { PrismaService } from '../prisma/prisma.service'
import { TokenRevocationService } from './token-revocation.service'

const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(TokenRevocationService) private readonly tokenRevocationService: TokenRevocationService,
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } })
    if (!user) {
      throw new UnauthorizedException('Invalid credentials')
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials')
    }

    const role = normalizeUserRole(user.role)
    if (!role) {
      throw new UnauthorizedException('Account has an unsupported role')
    }

    if (isManager(role) && !user.managerId) {
      throw new UnauthorizedException('Account not configured: no manager binding')
    }

    const managerId = user.managerId ?? null
    const payload = { sub: user.id, role, email: user.email, name: user.name, managerId }
    const accessToken = await this.jwt.signAsync(payload)

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role,
        managerId,
      },
      accessToken,
    }
  }

  async logout(token: string) {
    await this.tokenRevocationService.revoke(token)
  }

  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    })

    if (!user) {
      return {
        message: 'If the account exists, reset instructions have been generated.',
      }
    }

    const resetToken = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS)

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: this.hashPasswordResetToken(resetToken),
        passwordResetExpiresAt: expiresAt,
      },
    })

    return {
      message: 'If the account exists, reset instructions have been generated.',
      ...(this.shouldExposePasswordResetToken()
        ? {
            resetToken,
            expiresAt: expiresAt.toISOString(),
          }
        : {}),
    }
  }

  async confirmPasswordReset(token: string, password: string) {
    const now = new Date()
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetTokenHash: this.hashPasswordResetToken(token),
        passwordResetExpiresAt: { gt: now },
      },
      select: { id: true },
    })

    if (!user) {
      throw new UnauthorizedException('Reset token is invalid or expired')
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(password, 10),
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
      },
    })
  }

  private hashPasswordResetToken(token: string) {
    return createHash('sha256').update(token).digest('hex')
  }

  private shouldExposePasswordResetToken() {
    return isSafeEnv(this.configService.get<string>('NODE_ENV'))
  }
}
