import { ForbiddenException } from '@nestjs/common'
import { AIInsightsController } from './ai.controller'

describe('AIInsightsController', () => {
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

  it('allows admin to request team insights', async () => {
    const service = {
      listInsights: jest.fn().mockResolvedValue({ scope: 'TEAM', insights: [] }),
    } as any

    const controller = new AIInsightsController(service)
    await controller.listInsights({ scope: 'TEAM' }, adminUser)

    expect(service.listInsights).toHaveBeenCalledWith('TEAM', undefined)
  })

  it('allows admin to request a specific manager insight scope', async () => {
    const service = {
      listInsights: jest.fn().mockResolvedValue({ scope: 'MANAGER', insights: [] }),
    } as any

    const controller = new AIInsightsController(service)
    await controller.listInsights({ scope: 'MANAGER', managerId: 'manager-2' }, adminUser)

    expect(service.listInsights).toHaveBeenCalledWith('MANAGER', 'manager-2')
  })

  it('forces manager-role to use managerId from JWT', async () => {
    const service = {
      listInsights: jest.fn().mockResolvedValue({ scope: 'MANAGER', insights: [] }),
    } as any

    const controller = new AIInsightsController(service)
    await controller.listInsights({}, managerUser)

    expect(service.listInsights).toHaveBeenCalledWith('MANAGER', 'manager-1')
  })

  it('forbids manager-role from overriding managerId', async () => {
    const service = {
      listInsights: jest.fn(),
    } as any

    const controller = new AIInsightsController(service)

    await expect(
      controller.listInsights({ scope: 'MANAGER', managerId: 'manager-2' }, managerUser),
    ).rejects.toThrow(ForbiddenException)
    expect(service.listInsights).not.toHaveBeenCalled()
  })

  it('forbids manager-role from requesting team insights', async () => {
    const service = {
      listInsights: jest.fn(),
    } as any

    const controller = new AIInsightsController(service)

    await expect(controller.listInsights({ scope: 'TEAM' }, managerUser)).rejects.toThrow(ForbiddenException)
    expect(service.listInsights).not.toHaveBeenCalled()
  })
})
