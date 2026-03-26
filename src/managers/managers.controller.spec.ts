import { BadRequestException, ForbiddenException } from '@nestjs/common'
import { ManagersController } from './managers.controller'

describe('ManagersController', () => {
  const adminUser = {
    sub: 'admin-1',
    email: 'admin@example.com',
    role: 'admin',
    managerId: null,
  }

  const managerUser = {
    sub: 'user-1',
    email: 'manager@example.com',
    role: 'user',
    managerId: 'manager-1',
  }

  it('allows admin to list managers', async () => {
    const service = {
      listManagers: jest.fn().mockResolvedValue([]),
    } as any

    const controller = new ManagersController(service)
    await controller.listManagers({ month: '2026-03' }, adminUser)

    expect(service.listManagers).toHaveBeenCalledWith('2026-03')
  })

  it('allows admin to list team CRUD records', async () => {
    const service = {
      listAdminTeam: jest.fn().mockResolvedValue([]),
    } as any

    const controller = new ManagersController(service)
    await controller.listAdminTeam(adminUser)

    expect(service.listAdminTeam).toHaveBeenCalled()
  })

  it('allows admin to create team CRUD record', async () => {
    const service = {
      createAdminTeamMember: jest.fn().mockResolvedValue({ id: 'manager-1' }),
    } as any

    const controller = new ManagersController(service)
    const payload = {
      name: 'Alice',
      avatarUrl: 'https://example.com/a.png',
      user: {
        email: 'alice@example.com',
        password: 'temp-pass',
      },
    }

    await controller.createAdminTeamMember(payload, adminUser)

    expect(service.createAdminTeamMember).toHaveBeenCalledWith(payload)
  })

  it('allows admin to update team CRUD record', async () => {
    const service = {
      updateAdminTeamMember: jest.fn().mockResolvedValue({ id: 'manager-1' }),
    } as any

    const controller = new ManagersController(service)
    const payload = {
      name: 'Alice 2',
      avatarUrl: null,
      user: {
        email: 'alice+new@example.com',
      },
    }

    await controller.updateAdminTeamMember('manager-1', payload, adminUser)

    expect(service.updateAdminTeamMember).toHaveBeenCalledWith('manager-1', payload)
  })

  it('allows admin to read manager monthly plan', async () => {
    const service = {
      getAdminManagerMonthlyPlan: jest.fn().mockResolvedValue({ managerId: 'manager-1', month: '2026-03' }),
    } as any

    const controller = new ManagersController(service)
    await controller.getAdminManagerMonthlyPlan('manager-1', { month: '2026-03' }, adminUser)

    expect(service.getAdminManagerMonthlyPlan).toHaveBeenCalledWith('manager-1', '2026-03')
  })

  it('allows admin to upsert manager monthly plan', async () => {
    const service = {
      upsertAdminManagerMonthlyPlan: jest.fn().mockResolvedValue({ managerId: 'manager-1', month: '2026-03' }),
    } as any

    const controller = new ManagersController(service)
    const payload = {
      month: '2026-03',
      plan: {
        calls_total: 80,
        calls_target: 40,
        deals_count: 10,
        contracts_count: 5,
        invoices_count: 4,
        invoices_amount_rub: 250000,
        payments_count: 4,
        margin_rub: 200000,
        avg_check_rub: 62500,
      },
    }

    await controller.upsertAdminManagerMonthlyPlan('manager-1', payload, adminUser)

    expect(service.upsertAdminManagerMonthlyPlan).toHaveBeenCalledWith('manager-1', '2026-03', payload.plan)
  })

  it('rejects oversized monthly plan values', async () => {
    const service = {
      upsertAdminManagerMonthlyPlan: jest.fn(),
    } as any

    const controller = new ManagersController(service)

    await expect(
      controller.upsertAdminManagerMonthlyPlan(
        'manager-1',
        {
          month: '2026-03',
          plan: {
            calls_total: 80,
            calls_target: 40,
            deals_count: 10,
            contracts_count: 5,
            invoices_count: 4,
            invoices_amount_rub: 10000000000,
            payments_count: 4,
            margin_rub: 200000,
            avg_check_rub: 62500,
          },
        },
        adminUser,
      ),
    ).rejects.toThrow(BadRequestException)
  })

  it('forbids manager-role from listing all managers', async () => {
    const service = {
      listManagers: jest.fn(),
    } as any

    const controller = new ManagersController(service)

    await expect(controller.listManagers({ month: '2026-03' }, managerUser)).rejects.toThrow(ForbiddenException)
    expect(service.listManagers).not.toHaveBeenCalled()
  })

  it('forbids manager-role from accessing admin team CRUD endpoints', async () => {
    const service = {
      listAdminTeam: jest.fn(),
      createAdminTeamMember: jest.fn(),
      updateAdminTeamMember: jest.fn(),
      getAdminManagerMonthlyPlan: jest.fn(),
      upsertAdminManagerMonthlyPlan: jest.fn(),
    } as any

    const controller = new ManagersController(service)

    await expect(controller.listAdminTeam(managerUser)).rejects.toThrow(ForbiddenException)
    await expect(
      controller.createAdminTeamMember(
        {
          name: 'Alice',
          user: { email: 'alice@example.com', password: 'temp-pass' },
        },
        managerUser,
      ),
    ).rejects.toThrow(ForbiddenException)
    await expect(
      controller.updateAdminTeamMember(
        'manager-1',
        {
          name: 'Alice',
          user: { email: 'alice@example.com' },
        },
        managerUser,
      ),
    ).rejects.toThrow(ForbiddenException)
    await expect(controller.getAdminManagerMonthlyPlan('manager-1', { month: '2026-03' }, managerUser)).rejects.toThrow(
      ForbiddenException,
    )
    await expect(
      controller.upsertAdminManagerMonthlyPlan(
        'manager-1',
        {
          month: '2026-03',
          plan: {
            calls_total: 80,
            calls_target: 40,
            deals_count: 10,
            contracts_count: 5,
            invoices_count: 4,
            invoices_amount_rub: 250000,
            payments_count: 4,
            margin_rub: 200000,
            avg_check_rub: 62500,
          },
        },
        managerUser,
      ),
    ).rejects.toThrow(ForbiddenException)

    expect(service.listAdminTeam).not.toHaveBeenCalled()
    expect(service.createAdminTeamMember).not.toHaveBeenCalled()
    expect(service.updateAdminTeamMember).not.toHaveBeenCalled()
    expect(service.getAdminManagerMonthlyPlan).not.toHaveBeenCalled()
    expect(service.upsertAdminManagerMonthlyPlan).not.toHaveBeenCalled()
  })

  it('allows manager-role to read only own manager card', async () => {
    const service = {
      getManager: jest.fn().mockResolvedValue({ manager: { id: 'manager-1' } }),
    } as any

    const controller = new ManagersController(service)
    await controller.getManager('manager-1', { month: '2026-03' }, managerUser)

    expect(service.getManager).toHaveBeenCalledWith('manager-1', '2026-03', undefined)
  })

  it('forbids manager-role from requesting another manager card', async () => {
    const service = {
      getManager: jest.fn(),
    } as any

    const controller = new ManagersController(service)

    await expect(
      controller.getManager('manager-2', { month: '2026-03' }, managerUser),
    ).rejects.toThrow(ForbiddenException)
    expect(service.getManager).not.toHaveBeenCalled()
  })

  it('forbids manager-role from editing another manager note', async () => {
    const service = {
      upsertPlanNote: jest.fn(),
    } as any

    const controller = new ManagersController(service)

    await expect(
      controller.updatePlanNote('manager-2', '2026-03-19', { text: 'plan' }, managerUser),
    ).rejects.toThrow(ForbiddenException)
    expect(service.upsertPlanNote).not.toHaveBeenCalled()
  })
})
