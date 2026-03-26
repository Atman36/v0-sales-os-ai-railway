import { InternalServerErrorException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { TenantConfigService } from './tenant-config.service'

describe('TenantConfigService', () => {
  const buildService = (envValues: Record<string, string | undefined> = {}) => {
    const prisma = {
      tenantConfig: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    } as any

    const env = {
      get: jest.fn((key: string) => {
        const defaults: Record<string, string | undefined> = {
          NODE_ENV: 'development',
          TENANT_TIMEZONE: 'Europe/Moscow',
          SALESOS_WEBHOOK_SECRET: 'super-secret',
        }
        if (Object.prototype.hasOwnProperty.call(envValues, key)) {
          return envValues[key]
        }
        return defaults[key]
      }),
    } as unknown as ConfigService

    return {
      prisma,
      service: new TenantConfigService(prisma, env),
    }
  }

  it('creates a single shared company config when none exists', async () => {
    const { prisma, service } = buildService()
    prisma.tenantConfig.findMany.mockResolvedValue([])
    prisma.tenantConfig.create.mockResolvedValue({
      id: 'cfg-1',
      timezone: 'Europe/Moscow',
      webhookSecret: 'super-secret',
      funnelStageMapping: {},
      managerMapping: {},
      planDefaults: {},
    })

    await expect(service.getConfig()).resolves.toMatchObject({
      id: 'cfg-1',
      timezone: 'Europe/Moscow',
      webhookSecret: 'super-secret',
    })

    expect(prisma.tenantConfig.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'asc' },
      take: 2,
    })
    expect(prisma.tenantConfig.create).toHaveBeenCalledWith({
      data: {
        timezone: 'Europe/Moscow',
        webhookSecret: 'super-secret',
        funnelStageMapping: {},
        managerMapping: {},
        planDefaults: {},
      },
    })
  })

  it('updates the existing shared company config when exactly one row exists', async () => {
    const { prisma, service } = buildService()
    prisma.tenantConfig.findMany.mockResolvedValue([{ id: 'cfg-1' }])
    prisma.tenantConfig.update.mockResolvedValue({
      id: 'cfg-1',
      timezone: 'UTC',
    })

    await expect(service.updateConfig({ timezone: 'UTC' })).resolves.toMatchObject({
      id: 'cfg-1',
      timezone: 'UTC',
    })

    expect(prisma.tenantConfig.update).toHaveBeenCalledWith({
      where: { id: 'cfg-1' },
      data: { timezone: 'UTC' },
    })
  })

  it('rejects multiple tenant config rows because the product is single-tenant', async () => {
    const { prisma, service } = buildService()
    prisma.tenantConfig.findMany.mockResolvedValue([{ id: 'cfg-1' }, { id: 'cfg-2' }])

    await expect(service.getConfig()).rejects.toThrow(InternalServerErrorException)
    await expect(service.updateConfig({ timezone: 'UTC' })).rejects.toThrow(
      'Sales OS is running in single-tenant mode and expects exactly one shared company config record.',
    )
  })

  it('rejects default env webhook secret in deployment envs', async () => {
    const { prisma, service } = buildService({
      NODE_ENV: 'preview',
      SALESOS_WEBHOOK_SECRET: 'change-me',
    })
    prisma.tenantConfig.findMany.mockResolvedValue([])

    await expect(service.getConfig()).rejects.toThrow(
      'SALESOS_WEBHOOK_SECRET must be changed outside development/test.',
    )
    expect(prisma.tenantConfig.create).not.toHaveBeenCalled()
  })

  it('rejects missing env webhook secret in deployment envs', async () => {
    const { prisma, service } = buildService({
      NODE_ENV: 'stage',
      SALESOS_WEBHOOK_SECRET: undefined,
    })
    prisma.tenantConfig.findMany.mockResolvedValue([])

    await expect(service.getConfig()).rejects.toThrow(
      'SALESOS_WEBHOOK_SECRET is required outside development/test.',
    )
    expect(prisma.tenantConfig.create).not.toHaveBeenCalled()
  })

  it('rejects persisted placeholder webhook secret in deployment envs', async () => {
    const { prisma, service } = buildService({
      NODE_ENV: 'preview',
      SALESOS_WEBHOOK_SECRET: 'super-secret',
    })
    prisma.tenantConfig.findMany.mockResolvedValue([
      {
        id: 'cfg-1',
        webhookSecret: 'change-me',
      },
    ])

    await expect(service.getConfig()).rejects.toThrow(
      'Persisted TenantConfig.webhookSecret uses the default placeholder.',
    )
  })

  it('rejects persisted blank webhook secret in deployment envs', async () => {
    const { prisma, service } = buildService({
      NODE_ENV: 'preview',
      SALESOS_WEBHOOK_SECRET: 'super-secret',
    })
    prisma.tenantConfig.findMany.mockResolvedValue([
      {
        id: 'cfg-1',
        webhookSecret: '   ',
      },
    ])

    await expect(service.getConfig()).rejects.toThrow(
      'Persisted TenantConfig.webhookSecret is empty.',
    )
  })

  it('keeps local development working with the local-only placeholder', async () => {
    const { prisma, service } = buildService({
      NODE_ENV: 'development',
      SALESOS_WEBHOOK_SECRET: undefined,
    })
    prisma.tenantConfig.findMany.mockResolvedValue([])
    prisma.tenantConfig.create.mockResolvedValue({
      id: 'cfg-1',
      timezone: 'Europe/Moscow',
      webhookSecret: 'change-me',
      funnelStageMapping: {},
      managerMapping: {},
      planDefaults: {},
    })

    await expect(service.getConfig()).resolves.toMatchObject({
      webhookSecret: 'change-me',
    })
  })
})
