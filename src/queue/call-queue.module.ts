import { DynamicModule, Global, Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { CallQueueService } from './call-queue.service'

export function isCallProcessingEnabled(value?: string | null) {
  return value?.trim().toLowerCase() === 'true'
}

export function createDisabledCallQueueService(): CallQueueService {
  return {
    async enqueueProcessCall() {
      return null
    },
    async onModuleDestroy() {},
  } as unknown as CallQueueService
}

@Global()
@Module({})
export class CallQueueModule {
  static register(): DynamicModule {
    return {
      module: CallQueueModule,
      global: true,
      imports: [ConfigModule],
      providers: [
        {
          provide: CallQueueService,
          inject: [ConfigService],
          useFactory: (config: ConfigService) => {
            if (!isCallProcessingEnabled(config.get<string>('CALL_PROCESSING_ENABLED'))) {
              return createDisabledCallQueueService()
            }

            return new CallQueueService(config)
          },
        },
      ],
      exports: [CallQueueService],
    }
  }
}
