import { ForbiddenException } from '@nestjs/common'
import { DashboardController } from './dashboard.controller'

describe('DashboardController', () => {
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

  it('allows admin to read dashboard', async () => {
    const service = {
      getDashboard: jest.fn().mockResolvedValue({}),
    } as any

    const controller = new DashboardController(service)
    await controller.getDashboard({ from: '2026-03-01', to: '2026-03-31' }, adminUser)

    expect(service.getDashboard).toHaveBeenCalledWith(new Date('2026-03-01'), new Date('2026-03-31'))
  })

  it('forbids manager-role from reading dashboard', async () => {
    const service = {
      getDashboard: jest.fn(),
    } as any

    const controller = new DashboardController(service)

    await expect(
      controller.getDashboard({ from: '2026-03-01', to: '2026-03-31' }, managerUser),
    ).rejects.toThrow(ForbiddenException)
    expect(service.getDashboard).not.toHaveBeenCalled()
  })
})
