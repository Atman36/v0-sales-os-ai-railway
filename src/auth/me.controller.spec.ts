import { BadRequestException, ForbiddenException } from '@nestjs/common'
import { MeController } from './me.controller'

describe('MeController', () => {
  const currentUser = {
    sub: 'user-1',
    email: 'manager@example.com',
    role: 'user',
    name: 'Alice',
    managerId: 'manager-1',
  }

  it('returns auth context from GET /me', async () => {
    const service = {
      getSummary: jest.fn(),
      getPlan: jest.fn(),
    } as any

    const controller = new MeController(service)

    await expect(controller.me(currentUser)).resolves.toEqual({
      id: 'user-1',
      email: 'manager@example.com',
      role: 'user',
      name: 'Alice',
      managerId: 'manager-1',
    })
  })

  it('loads summary and plan only for the bound manager context', async () => {
    const service = {
      getSummary: jest.fn().mockResolvedValue({ ok: true }),
      getPlan: jest.fn().mockResolvedValue({ ok: true }),
    } as any

    const controller = new MeController(service)
    await controller.summary(currentUser)
    await controller.plan({ month: '2026-03' }, currentUser)

    expect(service.getSummary).toHaveBeenCalledWith('manager-1')
    expect(service.getPlan).toHaveBeenCalledWith('manager-1', '2026-03')
  })

  it('defaults /me/plan to the current month and validates the month format', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-20T10:00:00.000Z'))
    const service = {
      getSummary: jest.fn(),
      getPlan: jest.fn().mockResolvedValue({ ok: true }),
    } as any

    const controller = new MeController(service)
    await controller.plan({}, currentUser)
    expect(service.getPlan).toHaveBeenCalledWith('manager-1', '2026-03')

    await expect(controller.plan({ month: '2026-3' }, currentUser)).rejects.toThrow(BadRequestException)
    jest.useRealTimers()
  })

  it('rejects /me endpoints without manager binding', async () => {
    const service = {
      getSummary: jest.fn(),
      getPlan: jest.fn(),
    } as any

    const controller = new MeController(service)
    const userWithoutManager = { ...currentUser, managerId: null }

    await expect(controller.summary(userWithoutManager)).rejects.toThrow(ForbiddenException)
    await expect(controller.plan({}, userWithoutManager)).rejects.toThrow(ForbiddenException)
  })
})
