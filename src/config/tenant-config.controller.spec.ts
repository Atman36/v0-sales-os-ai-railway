import { ForbiddenException } from '@nestjs/common'
import type { CurrentAuthUser } from '../auth/access-control'
import { TenantConfigController } from './tenant-config.controller'

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

const THROTTLER_LIMIT_METADATA = 'THROTTLER:LIMIT'
const THROTTLER_TTL_METADATA = 'THROTTLER:TTL'

const getTestWebhookThrottleContract = () => ({
  limit: Reflect.getMetadata(`${THROTTLER_LIMIT_METADATA}default`, TenantConfigController.prototype.testWebhook) as number,
  ttl: Reflect.getMetadata(`${THROTTLER_TTL_METADATA}default`, TenantConfigController.prototype.testWebhook) as number,
})

describe('TenantConfigController', () => {
  const buildController = () => {
    const configService = {
      getConfig: jest.fn(),
      updateConfig: jest.fn(),
    } as any

    const aggregationService = {
      recomputeRange: jest.fn(),
    } as any

    return {
      configService,
      aggregationService,
      controller: new TenantConfigController(configService, aggregationService),
    }
  }

  it('returns explicit single-tenant guardrails with config payload', async () => {
    const { controller, configService } = buildController()
    configService.getConfig.mockResolvedValue({
      id: 'cfg-1',
      timezone: 'UTC',
      webhookSecret: 'secret',
      funnelStageMapping: {},
      managerMapping: {},
      planDefaults: {},
    })

    await expect(controller.getConfig(ropUser)).resolves.toMatchObject({
      id: 'cfg-1',
      timezone: 'UTC',
      guardrails: {
        mode: 'single_company',
        tenantIsolation: false,
        configScope: 'shared_company_defaults',
      },
    })
  })

  it('returns the same single-tenant guardrails after config updates', async () => {
    const { controller, configService } = buildController()
    configService.updateConfig.mockResolvedValue({
      id: 'cfg-1',
      timezone: 'Europe/Moscow',
      webhookSecret: 'secret',
      funnelStageMapping: {},
      managerMapping: {},
      planDefaults: {},
    })

    await expect(controller.updateConfig({ timezone: 'Europe/Moscow' }, ropUser)).resolves.toMatchObject({
      id: 'cfg-1',
      timezone: 'Europe/Moscow',
      guardrails: {
        mode: 'single_company',
        tenantIsolation: false,
        configScope: 'shared_company_defaults',
      },
    })
  })

  it('reports the throttle contract configured on test-webhook', async () => {
    const { controller, configService } = buildController()
    configService.getConfig.mockResolvedValue({
      id: 'cfg-1',
      timezone: 'UTC',
      webhookSecret: 'secret',
      funnelStageMapping: {},
      managerMapping: {},
      planDefaults: {},
    })

    const throttleContract = getTestWebhookThrottleContract()

    expect(throttleContract).toEqual({
      limit: expect.any(Number),
      ttl: expect.any(Number),
    })

    await expect(controller.testWebhook({ secret: 'secret' }, ropUser)).resolves.toMatchObject({
      ok: true,
      checks: {
        rateLimit: throttleContract,
      },
    })
  })

  it('rejects non-ROP access to config endpoints', async () => {
    const { controller } = buildController()

    await expect(controller.getConfig(managerUser)).rejects.toThrow(ForbiddenException)
    await expect(controller.updateConfig({}, managerUser)).rejects.toThrow(ForbiddenException)
    await expect(controller.recompute({}, managerUser)).rejects.toThrow(ForbiddenException)
  })
})
