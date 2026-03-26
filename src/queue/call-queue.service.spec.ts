import { ConfigService } from '@nestjs/config'
import { Queue } from 'bullmq'
import IORedis from 'ioredis'
import { CallQueueService } from './call-queue.service'

const addMock = jest.fn()
const closeMock = jest.fn()

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: addMock,
    close: closeMock,
  })),
}))

jest.mock('ioredis', () =>
  jest.fn().mockImplementation((url: string) => ({
    url,
  })),
)

describe('CallQueueService', () => {
  beforeEach(() => {
    addMock.mockReset()
    closeMock.mockReset()
    ;(Queue as unknown as jest.Mock).mockClear()
    ;(IORedis as unknown as jest.Mock).mockClear()
  })

  it('bootstraps bullmq with the configured redis url', () => {
    const config = {
      get: jest.fn().mockImplementation((key: string) => (key === 'REDIS_URL' ? 'redis://queue:6379' : undefined)),
    } as unknown as ConfigService

    new CallQueueService(config)

    expect(IORedis).toHaveBeenCalledWith('redis://queue:6379')
    expect(Queue).toHaveBeenCalledWith(
      'call-processing',
      expect.objectContaining({
        connection: expect.objectContaining({ url: 'redis://queue:6379' }),
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 10000 },
          removeOnComplete: 50,
          removeOnFail: 50,
        },
      }),
    )
  })

  it('adds process_call jobs to the queue', async () => {
    const config = {
      get: jest.fn().mockReturnValue('redis://queue:6379'),
    } as unknown as ConfigService
    addMock.mockResolvedValue({ id: 'job-42' })

    const service = new CallQueueService(config)

    await expect(service.enqueueProcessCall('call-42')).resolves.toEqual({ id: 'job-42' })
    expect(addMock).toHaveBeenCalledWith('process_call', { callId: 'call-42' })
  })

  it('closes the queue on shutdown', async () => {
    const config = {
      get: jest.fn().mockReturnValue('redis://queue:6379'),
    } as unknown as ConfigService
    closeMock.mockResolvedValue(undefined)

    const service = new CallQueueService(config)

    await expect(service.onModuleDestroy()).resolves.toBeUndefined()
    expect(closeMock).toHaveBeenCalled()
  })
})
