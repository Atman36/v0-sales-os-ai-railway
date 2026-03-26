import { Injectable, OnModuleDestroy } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Queue } from 'bullmq'
import IORedis from 'ioredis'

export type CallQueueJob = {
  id?: string | number | null
}

@Injectable()
export class CallQueueService implements OnModuleDestroy {
  private readonly queue: Queue

  constructor(config: ConfigService) {
    const redisUrl = config.get<string>('REDIS_URL') ?? 'redis://localhost:6379'
    const connection = new IORedis(redisUrl)
    this.queue = new Queue('call-processing', {
      // BullMQ and Nest can resolve different ioredis patch versions in this workspace.
      // Runtime shape is compatible, so we narrow the duplicated type mismatch here.
      connection: connection as any,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 10000 },
        removeOnComplete: 50,
        removeOnFail: 50,
      },
    })
  }

  async enqueueProcessCall(callId: string): Promise<CallQueueJob | null> {
    const job = await this.queue.add('process_call', { callId })
    return job
  }

  async onModuleDestroy() {
    await this.queue.close()
  }
}
