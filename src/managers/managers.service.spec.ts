import { BadRequestException, ConflictException, InternalServerErrorException } from '@nestjs/common'
import bcrypt from 'bcryptjs'
import { ManagersService } from './managers.service'

jest.mock('bcryptjs', () => ({
  __esModule: true,
  default: {
    hash: jest.fn(async (value: string) => `hashed:${value}`),
    compare: jest.fn(),
  },
}))

describe('ManagersService admin team CRUD', () => {
  const createLogger = () =>
    ({
      error: jest.fn(),
    }) as any

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('lists admin team records with normalized linked user payload', async () => {
    const prisma = {
      manager: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'manager-1',
            name: 'Alice',
            avatarUrl: 'https://example.com/a.png',
            user: {
              id: 'user-1',
              email: 'alice@example.com',
              role: 'USER',
            },
          },
          {
            id: 'manager-2',
            name: 'Bob',
            avatarUrl: null,
            user: null,
          },
        ]),
      },
    } as any

    const service = new ManagersService(prisma, {} as any, createLogger())
    await expect(service.listAdminTeam()).resolves.toEqual([
      {
        id: 'manager-1',
        name: 'Alice',
        avatarUrl: 'https://example.com/a.png',
        user: {
          id: 'user-1',
          email: 'alice@example.com',
          role: 'user',
        },
      },
      {
        id: 'manager-2',
        name: 'Bob',
        avatarUrl: undefined,
        user: null,
      },
    ])
  })

  it('creates manager and linked user with hashed password', async () => {
    const prisma = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<unknown>) => callback(prisma)),
      manager: {
        create: jest.fn().mockResolvedValue({
          id: 'manager-1',
          name: 'Alice',
          avatarUrl: null,
        }),
        findUnique: jest.fn().mockResolvedValue({
          id: 'manager-1',
          name: 'Alice',
          avatarUrl: null,
          user: {
            id: 'user-1',
            email: 'alice@example.com',
            role: 'USER',
          },
        }),
      },
      user: {
        create: jest.fn().mockResolvedValue({
          id: 'user-1',
        }),
      },
    } as any

    const service = new ManagersService(prisma, {} as any, createLogger())

    await expect(
      service.createAdminTeamMember({
        name: 'Alice',
        avatarUrl: null,
        user: {
          email: 'alice@example.com',
          password: 'temp-pass',
        },
      }),
    ).resolves.toEqual({
      id: 'manager-1',
      name: 'Alice',
      avatarUrl: undefined,
      user: {
        id: 'user-1',
        email: 'alice@example.com',
        role: 'user',
      },
    })

    expect(bcrypt.hash).toHaveBeenCalledWith('temp-pass', 10)
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: 'alice@example.com',
        passwordHash: 'hashed:temp-pass',
        name: 'Alice',
        role: 'USER',
        managerId: 'manager-1',
      },
    })
  })

  it('updates manager and linked user credentials', async () => {
    const prisma = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<unknown>) => callback(prisma)),
      manager: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'manager-1',
            name: 'Alice',
            avatarUrl: null,
            user: {
              id: 'user-1',
              email: 'alice@example.com',
              role: 'USER',
            },
          })
          .mockResolvedValueOnce({
            id: 'manager-1',
            name: 'Alice Updated',
            avatarUrl: 'https://example.com/a.png',
            user: {
              id: 'user-1',
              email: 'alice+new@example.com',
              role: 'USER',
            },
          }),
        update: jest.fn().mockResolvedValue({}),
      },
      user: {
        update: jest.fn().mockResolvedValue({}),
      },
    } as any

    const service = new ManagersService(prisma, {} as any, createLogger())

    await expect(
      service.updateAdminTeamMember('manager-1', {
        name: 'Alice Updated',
        avatarUrl: 'https://example.com/a.png',
        user: {
          email: 'alice+new@example.com',
          password: 'new-pass-1',
        },
      }),
    ).resolves.toEqual({
      id: 'manager-1',
      name: 'Alice Updated',
      avatarUrl: 'https://example.com/a.png',
      user: {
        id: 'user-1',
        email: 'alice+new@example.com',
        role: 'user',
      },
    })

    expect(prisma.manager.update).toHaveBeenCalledWith({
      where: { id: 'manager-1' },
      data: {
        name: 'Alice Updated',
        avatarUrl: 'https://example.com/a.png',
      },
    })

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        name: 'Alice Updated',
        email: 'alice+new@example.com',
        passwordHash: 'hashed:new-pass-1',
      },
    })
  })

  it('creates linked user on update when manager account is missing', async () => {
    const prisma = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<unknown>) => callback(prisma)),
      manager: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'manager-1',
            name: 'Alice',
            avatarUrl: null,
            user: null,
          })
          .mockResolvedValueOnce({
            id: 'manager-1',
            name: 'Alice',
            avatarUrl: undefined,
            user: {
              id: 'user-1',
              email: 'alice@example.com',
              role: 'USER',
            },
          }),
        update: jest.fn().mockResolvedValue({}),
      },
      user: {
        create: jest.fn().mockResolvedValue({}),
      },
    } as any

    const service = new ManagersService(prisma, {} as any, createLogger())

    await service.updateAdminTeamMember('manager-1', {
      name: 'Alice',
      user: {
        email: 'alice@example.com',
        password: 'temp-pass',
      },
    })

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: 'alice@example.com',
        passwordHash: 'hashed:temp-pass',
        name: 'Alice',
        role: 'USER',
        managerId: 'manager-1',
      },
    })
  })

  it('rejects partial linked user creation on update', async () => {
    const prisma = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<unknown>) => callback(prisma)),
      manager: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'manager-1',
          name: 'Alice',
          avatarUrl: null,
          user: null,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      user: {
        create: jest.fn(),
      },
    } as any

    const service = new ManagersService(prisma, {} as any, createLogger())

    await expect(
      service.updateAdminTeamMember('manager-1', {
        name: 'Alice',
        user: {
          email: 'alice@example.com',
        },
      }),
    ).rejects.toThrow(BadRequestException)

    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  it('maps unique email violation to conflict exception', async () => {
    const prisma = {
      $transaction: jest.fn().mockRejectedValue({
        code: 'P2002',
        meta: {
          target: ['email'],
        },
      }),
    } as any

    const service = new ManagersService(prisma, {} as any, createLogger())

    await expect(
      service.createAdminTeamMember({
        name: 'Alice',
        user: {
          email: 'alice@example.com',
          password: 'temp-pass',
        },
      }),
    ).rejects.toThrow(ConflictException)
  })

  it('wraps unexpected manager write errors and logs the original message', async () => {
    const logger = createLogger()
    const prisma = {
      $transaction: jest.fn().mockRejectedValue(new Error('relation "User" does not exist')),
    } as any

    const service = new ManagersService(prisma, {} as any, logger)

    await expect(
      service.createAdminTeamMember({
        name: 'Alice',
        user: {
          email: 'alice@example.com',
          password: 'temp-pass',
        },
      }),
    ).rejects.toThrow(new InternalServerErrorException('Failed to create/update manager: relation "User" does not exist'))

    expect(logger.error).toHaveBeenCalledWith({
      msg: 'Unexpected error in admin team write',
      error: 'relation "User" does not exist',
    })
  })

  it('returns effective monthly plan for admin editing with manager override priority', async () => {
    const prisma = {
      manager: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'manager-1',
          name: 'Alice',
        }),
      },
      managerMonthlyPlan: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'plan-1',
          managerId: 'manager-1',
          month: '2026-03',
          plan: {
            calls_total: 70,
            margin_rub: 250000,
          },
        }),
      },
    } as any

    const configService = {
      getConfig: jest.fn().mockResolvedValue({
        planDefaults: {
          calls_total: 60,
          deals_count: 12,
          margin_rub: 180000,
        },
      }),
    } as any

    const service = new ManagersService(prisma, configService, createLogger())

    await expect(service.getAdminManagerMonthlyPlan('manager-1', '2026-03')).resolves.toEqual({
      managerId: 'manager-1',
      month: '2026-03',
      source: 'manager',
      effectivePlan: {
        calls_total: 70,
        calls_target: 0,
        deals_count: 12,
        contracts_count: 0,
        invoices_count: 0,
        invoices_amount_rub: 0,
        payments_count: 0,
        margin_rub: 250000,
        avg_check_rub: 0,
      },
    })
  })

  it('strips legacy alias keys from admin monthly plan effective payload', async () => {
    const prisma = {
      manager: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'manager-1',
          name: 'Alice',
        }),
      },
      managerMonthlyPlan: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    } as any

    const configService = {
      getConfig: jest.fn().mockResolvedValue({
        planDefaults: {
          calls_total: 60,
          margin: 180000,
          invoices: 3,
          payments: 2,
          avgCheck: 50000,
          invoices_amount: 210000,
        },
      }),
    } as any

    const service = new ManagersService(prisma, configService, createLogger())
    const result = await service.getAdminManagerMonthlyPlan('manager-1', '2026-03')

    expect(result).toEqual({
      managerId: 'manager-1',
      month: '2026-03',
      source: 'tenant_default',
      effectivePlan: {
        calls_total: 60,
        calls_target: 0,
        deals_count: 0,
        contracts_count: 0,
        invoices_count: 3,
        invoices_amount_rub: 210000,
        payments_count: 2,
        margin_rub: 180000,
        avg_check_rub: 50000,
      },
    })

    expect(result.effectivePlan).not.toHaveProperty('margin')
    expect(result.effectivePlan).not.toHaveProperty('invoices')
    expect(result.effectivePlan).not.toHaveProperty('payments')
    expect(result.effectivePlan).not.toHaveProperty('avgCheck')
    expect(result.effectivePlan).not.toHaveProperty('invoices_amount')
  })

  it('upserts personal monthly plan for manager', async () => {
    const prisma = {
      manager: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'manager-1',
          name: 'Alice',
        }),
      },
      managerMonthlyPlan: {
        upsert: jest.fn().mockResolvedValue({
          managerId: 'manager-1',
          month: '2026-03',
          plan: {
            calls_total: 80,
            deals_count: 10,
            contracts_count: 5,
            invoices_count: 4,
            invoices_amount_rub: 250000,
            payments_count: 4,
            margin_rub: 200000,
            avg_check_rub: 62500,
            calls_target: 40,
          },
        }),
      },
    } as any

    const configService = {
      getConfig: jest.fn().mockResolvedValue({
        planDefaults: {
          calls_total: 60,
          margin_rub: 180000,
        },
      }),
    } as any

    const service = new ManagersService(prisma, configService, createLogger())
    const payload = {
      calls_total: 80,
      calls_target: 40,
      deals_count: 10,
      contracts_count: 5,
      invoices_count: 4,
      invoices_amount_rub: 250000,
      payments_count: 4,
      margin_rub: 200000,
      avg_check_rub: 62500,
    }

    await expect(service.upsertAdminManagerMonthlyPlan('manager-1', '2026-03', payload)).resolves.toEqual({
      managerId: 'manager-1',
      month: '2026-03',
      source: 'manager',
      effectivePlan: payload,
    })

    expect(prisma.managerMonthlyPlan.upsert).toHaveBeenCalledWith({
      where: {
        managerId_month: {
          managerId: 'manager-1',
          month: '2026-03',
        },
      },
      update: {
        plan: payload,
      },
      create: {
        managerId: 'manager-1',
        month: '2026-03',
        plan: payload,
      },
    })
  })

  it('returns manager card without degraded flag when AI insights load successfully', async () => {
    const prisma = {
      manager: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'manager-1',
          name: 'Alice',
          avatarUrl: null,
        }),
      },
      dailyMetrics: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      dailyPlanNote: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      aIInsight: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'insight-1',
            scope: 'MANAGER',
            type: 'RISK',
            title: 'Оплаты замедлились',
            summary: 'Нужно ускорить follow-up.',
            why: 'Часть счетов без контакта.',
            recommendedActions: ['Связаться с клиентами со счетами старше 3 дней'],
            impactEstimate: 50000,
            confidence: 0.9,
            relatedManagerIds: ['manager-1'],
            relatedMetrics: ['payments_count'],
            managerId: 'manager-1',
          },
        ]),
      },
      managerMonthlyPlan: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    } as any

    const configService = {
      getConfig: jest.fn().mockResolvedValue({
        planDefaults: {
          margin_rub: 180000,
        },
      }),
    } as any
    const logger = createLogger()

    const service = new ManagersService(prisma, configService, logger)
    const result = await service.getManager('manager-1', '2026-03', '2026-03-01')

    expect(result.aiTip).toContain('Связаться с клиентами')
    expect(result.aiInsights).toBeUndefined()
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('keeps manager list available and marks AI insights degraded when loading fails', async () => {
    const prisma = {
      manager: {
        findMany: jest.fn().mockResolvedValue([{ id: 'manager-1', name: 'Alice', avatarUrl: null }]),
        findUnique: jest.fn().mockResolvedValue({
          id: 'manager-1',
          name: 'Alice',
          avatarUrl: null,
        }),
      },
      dailyMetrics: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      aIInsight: {
        findMany: jest.fn().mockRejectedValue(new Error('AI storage unavailable')),
      },
    } as any

    const configService = {
      getConfig: jest.fn().mockResolvedValue({
        planDefaults: {
          margin_rub: 180000,
        },
      }),
    } as any
    const logger = createLogger()

    const service = new ManagersService(prisma, configService, logger)

    await expect(service.listManagers('2026-03')).resolves.toEqual([
      expect.objectContaining({
        manager: expect.objectContaining({
          id: 'manager-1',
          name: 'Alice',
        }),
        aiTip: undefined,
        aiInsights: {
          degraded: true,
        },
      }),
    ])
    expect(logger.error).toHaveBeenCalledWith({
      msg: 'Failed to load AI insights for managers response',
      scope: 'managers_list',
      month: '2026-03',
      managerId: undefined,
      dailyFrom: undefined,
      error: expect.any(Error),
    })
  })

  it('marks manager detail AI insights degraded with request context when loading fails', async () => {
    const prisma = {
      manager: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'manager-1',
          name: 'Alice',
          avatarUrl: null,
        }),
      },
      dailyMetrics: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      dailyPlanNote: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      aIInsight: {
        findMany: jest.fn().mockRejectedValue(new Error('AI storage unavailable')),
      },
      managerMonthlyPlan: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    } as any

    const configService = {
      getConfig: jest.fn().mockResolvedValue({
        planDefaults: {
          margin_rub: 180000,
        },
      }),
    } as any
    const logger = createLogger()

    const service = new ManagersService(prisma, configService, logger)
    const result = await service.getManager('manager-1', '2026-03', '2026-03-10')

    expect(result.aiTip).toBeUndefined()
    expect(result.aiInsights).toEqual({ degraded: true })
    expect(logger.error).toHaveBeenCalledWith({
      msg: 'Failed to load AI insights for managers response',
      scope: 'manager_detail',
      month: '2026-03',
      managerId: 'manager-1',
      dailyFrom: '2026-03-10',
      error: expect.any(Error),
    })
  })
})
