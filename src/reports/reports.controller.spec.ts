import { BadRequestException, ForbiddenException } from '@nestjs/common'
import { ReportsController } from './reports.controller'

describe('ReportsController', () => {
  const currentUser = {
    sub: 'user-1',
    email: 'manager@example.com',
    role: 'user',
    managerId: 'manager-1',
  }

  it('gets the current manager report by date', async () => {
    const service = {
      getMyReport: jest.fn().mockResolvedValue({ id: 'report-1' }),
    } as any

    const controller = new ReportsController(service)
    await controller.getMyReport('2026-03-19', currentUser)

    expect(service.getMyReport).toHaveBeenCalledWith('manager-1', '2026-03-19')
  })

  it('upserts the current manager report', async () => {
    const service = {
      upsertMyReport: jest.fn().mockResolvedValue({
        report: { id: 'report-1' },
        outcome: 'report_saved_metrics_synced',
      }),
    } as any

    const controller = new ReportsController(service)
    const payload = {
      calls_total: 10,
      calls_target: 6,
      deals_count: 2,
      contracts_count: 1,
      invoices_count: 1,
      invoices_amount_rub: 100000.55,
      payments_count: 1,
      margin_rub: 30000.25,
      comment: 'ok',
    }

    await expect(controller.upsertMyReport('2026-03-19', payload, currentUser)).resolves.toMatchObject({
      report: { id: 'report-1' },
      outcome: 'report_saved_metrics_synced',
    })

    expect(service.upsertMyReport).toHaveBeenCalledWith('manager-1', '2026-03-19', payload)
  })

  it('lists current manager reports for a validated range', async () => {
    const service = {
      listMyReports: jest.fn().mockResolvedValue([]),
    } as any

    const controller = new ReportsController(service)
    await controller.listMyReports({ from: '2026-03-13', to: '2026-03-19' }, currentUser)

    expect(service.listMyReports).toHaveBeenCalledWith('manager-1', '2026-03-13', '2026-03-19')
  })

  it('rejects invalid payloads', async () => {
    const service = {
      upsertMyReport: jest.fn(),
    } as any

    const controller = new ReportsController(service)

    await expect(
      controller.upsertMyReport(
        '2026-03-19',
        {
          calls_total: -1,
          calls_target: 0,
          deals_count: 0,
          contracts_count: 0,
          invoices_count: 0,
          invoices_amount_rub: 0,
          payments_count: 0,
          margin_rub: 0,
          comment: '',
        },
        currentUser,
      ),
    ).rejects.toThrow(BadRequestException)
  })

  it('rejects oversized numeric payloads', async () => {
    const service = {
      upsertMyReport: jest.fn(),
    } as any

    const controller = new ReportsController(service)

    await expect(
      controller.upsertMyReport(
        '2026-03-19',
        {
          calls_total: 10,
          calls_target: 6,
          deals_count: 2,
          contracts_count: 1,
          invoices_count: 1,
          invoices_amount_rub: 10000000000,
          payments_count: 1,
          margin_rub: 30000,
          comment: 'too large',
        },
        currentUser,
      ),
    ).rejects.toThrow(BadRequestException)
  })

  it('rejects invalid dates and inverted ranges', async () => {
    const service = {
      getMyReport: jest.fn(),
      listMyReports: jest.fn(),
    } as any

    const controller = new ReportsController(service)

    await expect(controller.getMyReport('2026-02-31', currentUser)).rejects.toThrow(BadRequestException)
    await expect(
      controller.listMyReports({ from: '2026-03-19', to: '2026-03-13' }, currentUser),
    ).rejects.toThrow(BadRequestException)
  })

  it('rejects requests without manager binding', async () => {
    const service = {
      getMyReport: jest.fn(),
    } as any

    const controller = new ReportsController(service)

    await expect(
      controller.getMyReport('2026-03-19', {
        ...currentUser,
        managerId: null,
      }),
    ).rejects.toThrow(ForbiddenException)
  })
})
