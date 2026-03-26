import { UnauthorizedException } from '@nestjs/common'
import bcrypt from 'bcryptjs'
import { createHash } from 'crypto'
import { AuthService } from './auth.service'

describe('AuthService', () => {
  const buildConfigService = (nodeEnv = 'test') =>
    ({
      get: jest.fn((key: string) => {
        if (key === 'NODE_ENV') {
          return nodeEnv
        }
        return undefined
      }),
    }) as any

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('returns admin token payload on successful admin login', async () => {
    const passwordHash = await bcrypt.hash('admin123', 4)
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'admin-1',
          email: 'admin@salesos.ai',
          name: 'Admin',
          role: 'ADMIN',
          passwordHash,
          managerId: null,
        }),
      },
    } as any

    const jwt = {
      signAsync: jest.fn().mockResolvedValue('signed-admin-token'),
    } as any

    const tokenRevocationService = {
      revoke: jest.fn(),
    } as any

    const service = new AuthService(prisma, jwt, tokenRevocationService, buildConfigService())
    const result = await service.login('admin@salesos.ai', 'admin123')

    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'admin@salesos.ai' } })
    expect(jwt.signAsync).toHaveBeenCalledWith({
      sub: 'admin-1',
      role: 'admin',
      email: 'admin@salesos.ai',
      name: 'Admin',
      managerId: null,
    })
    expect(result.user).toEqual({
      id: 'admin-1',
      email: 'admin@salesos.ai',
      name: 'Admin',
      role: 'admin',
      managerId: null,
    })
    expect(result.accessToken).toBe('signed-admin-token')
  })

  it('returns manager token payload on successful manager login', async () => {
    const passwordHash = await bcrypt.hash('manager123', 4)
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'mgr-001@salesos.ai',
          name: 'Менеджер',
          role: 'USER',
          passwordHash,
          managerId: 'manager-1',
        }),
      },
    } as any

    const jwt = {
      signAsync: jest.fn().mockResolvedValue('signed-manager-token'),
    } as any

    const tokenRevocationService = {
      revoke: jest.fn(),
    } as any

    const service = new AuthService(prisma, jwt, tokenRevocationService, buildConfigService())
    const result = await service.login('mgr-001@salesos.ai', 'manager123')

    expect(jwt.signAsync).toHaveBeenCalledWith({
      sub: 'user-1',
      role: 'user',
      email: 'mgr-001@salesos.ai',
      name: 'Менеджер',
      managerId: 'manager-1',
    })
    expect(result.user).toEqual({
      id: 'user-1',
      email: 'mgr-001@salesos.ai',
      name: 'Менеджер',
      role: 'user',
      managerId: 'manager-1',
    })
  })

  it('rejects invalid password', async () => {
    const passwordHash = await bcrypt.hash('manager123', 4)
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'mgr-001@salesos.ai',
          name: 'Менеджер',
          role: 'USER',
          passwordHash,
          managerId: 'manager-1',
        }),
      },
    } as any

    const jwt = {
      signAsync: jest.fn(),
    } as any

    const tokenRevocationService = {
      revoke: jest.fn(),
    } as any

    const service = new AuthService(prisma, jwt, tokenRevocationService, buildConfigService())

    await expect(service.login('mgr-001@salesos.ai', 'wrong-password')).rejects.toThrow(UnauthorizedException)
    expect(jwt.signAsync).not.toHaveBeenCalled()
  })

  it('rejects manager-role account without manager binding', async () => {
    const passwordHash = await bcrypt.hash('manager123', 4)
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'mgr-001@salesos.ai',
          name: 'Менеджер',
          role: 'USER',
          passwordHash,
          managerId: null,
        }),
      },
    } as any

    const jwt = {
      signAsync: jest.fn(),
    } as any

    const tokenRevocationService = {
      revoke: jest.fn(),
    } as any

    const service = new AuthService(prisma, jwt, tokenRevocationService, buildConfigService())

    await expect(service.login('mgr-001@salesos.ai', 'manager123')).rejects.toThrow(UnauthorizedException)
    expect(jwt.signAsync).not.toHaveBeenCalled()
  })

  it('revokes the presented token on logout', async () => {
    const prisma = {} as any
    const jwt = {} as any
    const tokenRevocationService = {
      revoke: jest.fn(),
    } as any

    const service = new AuthService(prisma, jwt, tokenRevocationService, buildConfigService())
    await service.logout('signed-manager-token')

    expect(tokenRevocationService.revoke).toHaveBeenCalledWith('signed-manager-token')
  })

  it('waits for revocation persistence before logout resolves', async () => {
    const prisma = {} as any
    const jwt = {} as any
    let resolveRevoke: (() => void) | undefined
    const tokenRevocationService = {
      revoke: jest.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveRevoke = resolve
          }),
      ),
    } as any

    const service = new AuthService(prisma, jwt, tokenRevocationService, buildConfigService())
    let logoutSettled = false
    const logoutPromise = service.logout('signed-manager-token').then(() => {
      logoutSettled = true
    })

    await Promise.resolve()

    expect(logoutSettled).toBe(false)
    resolveRevoke?.()
    await logoutPromise
    expect(tokenRevocationService.revoke).toHaveBeenCalledWith('signed-manager-token')
  })

  it('stores a hashed reset token and returns the raw token only in safe envs', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'user-1' }),
        update: jest.fn().mockResolvedValue({}),
      },
    } as any

    const service = new AuthService(prisma, {} as any, {} as any, buildConfigService('test'))
    const result = await service.requestPasswordReset('mgr-001@salesos.ai')

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'mgr-001@salesos.ai' },
      select: { id: true },
    })
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        passwordResetTokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        passwordResetExpiresAt: expect.any(Date),
      },
    })
    expect(result).toEqual({
      message: 'If the account exists, reset instructions have been generated.',
      resetToken: expect.stringMatching(/^[a-f0-9]{64}$/),
      expiresAt: expect.any(String),
    })
  })

  it('hides the raw reset token in preview env', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'user-1' }),
        update: jest.fn().mockResolvedValue({}),
      },
    } as any

    const service = new AuthService(prisma, {} as any, {} as any, buildConfigService('preview'))
    await expect(service.requestPasswordReset('mgr-001@salesos.ai')).resolves.toEqual({
      message: 'If the account exists, reset instructions have been generated.',
    })
  })

  it('returns a generic reset response for unknown emails', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
    } as any

    const service = new AuthService(prisma, {} as any, {} as any, buildConfigService())
    await expect(service.requestPasswordReset('missing@salesos.ai')).resolves.toEqual({
      message: 'If the account exists, reset instructions have been generated.',
    })
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('updates password hash and clears reset token on successful reset', async () => {
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'user-1' }),
        update: jest.fn().mockResolvedValue({}),
      },
    } as any

    const service = new AuthService(prisma, {} as any, {} as any, buildConfigService())
    await service.confirmPasswordReset('a'.repeat(64), 'new-pass-1')

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        passwordResetTokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        passwordResetExpiresAt: { gt: expect.any(Date) },
      },
      select: { id: true },
    })

    const updateCall = prisma.user.update.mock.calls[0]?.[0]
    expect(updateCall.where).toEqual({ id: 'user-1' })
    expect(updateCall.data.passwordResetTokenHash).toBeNull()
    expect(updateCall.data.passwordResetExpiresAt).toBeNull()
    await expect(bcrypt.compare('new-pass-1', updateCall.data.passwordHash)).resolves.toBe(true)
  })

  it('rejects expired or invalid reset tokens', async () => {
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
    } as any

    const service = new AuthService(prisma, {} as any, {} as any, buildConfigService())

    await expect(service.confirmPasswordReset('a'.repeat(64), 'new-pass-1')).rejects.toThrow(
      UnauthorizedException,
    )
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('invalidates the old password once reset is confirmed', async () => {
    const rawToken = 'b'.repeat(64)
    const storedUser = {
      id: 'user-1',
      email: 'mgr-001@salesos.ai',
      name: 'Менеджер',
      role: 'USER',
      managerId: 'manager-1',
      passwordHash: await bcrypt.hash('old-pass-1', 4),
      passwordResetTokenHash: createHash('sha256').update(rawToken).digest('hex'),
      passwordResetExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
    }

    const prisma = {
      user: {
        findUnique: jest.fn().mockImplementation(({ where }: { where: { email: string } }) => {
          if (where.email !== storedUser.email) {
            return null
          }
          return storedUser
        }),
        findFirst: jest.fn().mockImplementation(({ where }: { where: { passwordResetTokenHash: string; passwordResetExpiresAt: { gt: Date } } }) => {
          if (
            where.passwordResetTokenHash === storedUser.passwordResetTokenHash &&
            storedUser.passwordResetExpiresAt &&
            storedUser.passwordResetExpiresAt > where.passwordResetExpiresAt.gt
          ) {
            return { id: storedUser.id }
          }
          return null
        }),
        update: jest.fn().mockImplementation(({ data }: { data: Partial<typeof storedUser> }) => {
          Object.assign(storedUser, data)
          return storedUser
        }),
      },
    } as any

    const jwt = {
      signAsync: jest.fn().mockResolvedValue('signed-token'),
    } as any

    const service = new AuthService(prisma, jwt, {} as any, buildConfigService())

    await expect(service.login(storedUser.email, 'old-pass-1')).resolves.toMatchObject({
      accessToken: 'signed-token',
    })

    await service.confirmPasswordReset(rawToken, 'new-pass-1')

    await expect(service.login(storedUser.email, 'old-pass-1')).rejects.toThrow(UnauthorizedException)
    await expect(service.login(storedUser.email, 'new-pass-1')).resolves.toMatchObject({
      accessToken: 'signed-token',
    })
  })
})
