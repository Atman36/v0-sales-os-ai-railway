import { ConfigService } from '@nestjs/config'
import { CallQueueModule, createDisabledCallQueueService, isCallProcessingEnabled } from './call-queue.module'
import { CallQueueService } from './call-queue.service'

describe('CallQueueModule', () => {
  it('treats call processing as disabled by default', () => {
    expect(isCallProcessingEnabled(undefined)).toBe(false)
    expect(isCallProcessingEnabled('false')).toBe(false)
    expect(isCallProcessingEnabled('TRUE')).toBe(true)
  })

  it('registers a global queue provider', () => {
    const dynamicModule = CallQueueModule.register()

    expect(dynamicModule.global).toBe(true)
    expect(dynamicModule.exports).toEqual([CallQueueService])
  })

  it('returns a no-op queue service when call processing is disabled', async () => {
    const dynamicModule = CallQueueModule.register()
    const provider = dynamicModule.providers?.find(
      (candidate) => typeof candidate === 'object' && 'provide' in candidate && candidate.provide === CallQueueService,
    ) as {
      useFactory: (config: ConfigService) => CallQueueService
    }

    const service = provider.useFactory({
      get: jest.fn().mockReturnValue('false'),
    } as unknown as ConfigService)

    await expect(service.enqueueProcessCall('call-1')).resolves.toBeNull()
  })

  it('creates the documented no-op queue service', async () => {
    const service = createDisabledCallQueueService()

    await expect(service.enqueueProcessCall('call-1')).resolves.toBeNull()
    await expect(service.onModuleDestroy()).resolves.toBeUndefined()
  })
})
