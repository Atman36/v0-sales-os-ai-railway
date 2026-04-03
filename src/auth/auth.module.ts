import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { AuthController } from './auth.controller'
import { MeController } from './me.controller'
import { AuthService } from './auth.service'
import { JwtStrategy } from './jwt.strategy'
import { JwtAuthGuard } from './jwt-auth.guard'
import { RolesGuard } from './roles.guard'
import { createJwtModuleOptions } from './jwt-config'
import { TenantConfigModule } from '../config/tenant-config.module'
import { MeService } from './me.service'
import { TokenRevocationService } from './token-revocation.service'
import {
  InMemoryTokenRevocationStore,
  PrismaTokenRevocationStore,
  TOKEN_REVOCATION_STORE,
  type TokenRevocationStore,
} from './token-revocation.store'
import { resolveTokenRevocationBackend } from './token-revocation.config'

function assertUnsupportedTokenRevocationBackend(backend: never): never {
  throw new Error(`Unsupported token revocation backend: ${String(backend)}`)
}

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    TenantConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        createJwtModuleOptions(
          config.get<string>('JWT_SECRET'),
          config.get<string>('NODE_ENV'),
        ),
    }),
  ],
  controllers: [AuthController, MeController],
  providers: [
    AuthService,
    MeService,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    TokenRevocationService,
    InMemoryTokenRevocationStore,
    PrismaTokenRevocationStore,
    {
      provide: TOKEN_REVOCATION_STORE,
      inject: [ConfigService, InMemoryTokenRevocationStore, PrismaTokenRevocationStore],
      useFactory: (
        config: ConfigService,
        inMemoryStore: InMemoryTokenRevocationStore,
        prismaStore: PrismaTokenRevocationStore,
      ): TokenRevocationStore => {
        const backend = resolveTokenRevocationBackend(
          config.get<string>('AUTH_TOKEN_REVOCATION_BACKEND'),
          config.get<string>('NODE_ENV'),
        )

        if (backend === 'memory') {
          return inMemoryStore
        }

        // Deployments should prefer the existing Prisma-backed database store for durable logout.
        if (backend === 'database') {
          return prismaStore
        }

        return assertUnsupportedTokenRevocationBackend(backend)
      },
    },
  ],
  exports: [AuthService, JwtAuthGuard, RolesGuard, TokenRevocationService, TOKEN_REVOCATION_STORE],
})
export class AuthModule {}
