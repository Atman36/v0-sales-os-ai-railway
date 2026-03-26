import { ForbiddenException } from '@nestjs/common'
import type { CurrentAuthUser } from '../auth/access-control'
import { ImportController } from './import.controller'

const ropUser: CurrentAuthUser = {
  sub: 'user-1',
  email: 'admin@salesos.ai',
  role: 'admin',
  name: 'Admin',
  managerId: null,
}

const managerUser: CurrentAuthUser = {
  sub: 'user-2',
  email: 'mgr-001@salesos.ai',
  role: 'user',
  name: 'Manager',
  managerId: 'manager-1',
}

describe('ImportController', () => {
  it('accepts Excel uploads for ROP users', async () => {
    const controller = new ImportController()

    await expect(
      controller.importExcel(
        {
          originalname: 'report.xlsx',
          size: 1024,
          mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
        ropUser,
      ),
    ).resolves.toMatchObject({
      status: 'accepted',
      filename: 'report.xlsx',
    })
  })

  it('rejects non-ROP users before processing the file', async () => {
    const controller = new ImportController()

    await expect(
      controller.importExcel(
        {
          originalname: 'report.xlsx',
          size: 1024,
          mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
        managerUser,
      ),
    ).rejects.toThrow(ForbiddenException)
  })
})
