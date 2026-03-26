import { UnauthorizedException } from '@nestjs/common'
import { BitrixService } from './bitrix.service'

describe('BitrixService', () => {
  const buildDeps = () => {
    const seenEventKeys = new Set<string>()
    const prisma = {
      eventLog: {
        create: jest.fn().mockImplementation(async ({ data }: { data: { eventKey?: string } }) => {
          if (!data.eventKey) {
            throw new Error('eventKey is required')
          }

          if (seenEventKeys.has(data.eventKey)) {
            throw { code: 'P2002' }
          }

          seenEventKeys.add(data.eventKey)
          return { id: data.eventKey }
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      deal: {
        upsert: jest.fn(),
      },
      dealStageHistory: {
        create: jest.fn().mockResolvedValue({}),
      },
      call: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      manager: {
        findUnique: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
      },
    } as any
    const tenantConfig = {
      getConfig: jest.fn().mockResolvedValue({
        webhookSecret: 'expected-secret',
        funnelStageMapping: {},
        managerMapping: {},
      }),
    } as any
    const aggregation = { recomputeForDate: jest.fn().mockResolvedValue({}) } as any
    const callQueue = {
      enqueueProcessCall: jest.fn().mockResolvedValue({ id: 'job-1' }),
    } as any
    const logger = { warn: jest.fn() } as any

    return { prisma, tenantConfig, aggregation, callQueue, logger }
  }

  const buildDealPayload = (params?: {
    eventType?: string
    title?: string
    amount?: string
    stageId?: string
    modifiedAt?: string
  }) => ({
    event: params?.eventType ?? 'deal.updated',
    data: {
      ID: 'deal-1',
      TITLE: params?.title ?? 'First title',
      OPPORTUNITY: params?.amount ?? '1000',
      STAGE_ID: params?.stageId ?? 'NEW',
      DATE_MODIFY: params?.modifiedAt ?? '2026-03-20T10:00:00.000Z',
    },
  })

  const buildCallPayload = (eventType = 'call.created', recordingUrl = 'https://example.com/call.mp3') => ({
    event: eventType,
    data: {
      CALL_ID: 'call-1',
      RECORDING_URL: recordingUrl,
      CALL_START_DATE: '2026-03-20T10:00:00.000Z',
    },
  })

  it('rejects invalid webhook secret', async () => {
    const { prisma, tenantConfig, aggregation, callQueue, logger } = buildDeps()

    const service = new BitrixService(prisma, tenantConfig, aggregation, callQueue, logger)

    await expect(service.handleWebhook({}, 'wrong-secret')).rejects.toThrow(UnauthorizedException)
  })

  it('enqueues processing for a new call with recording url', async () => {
    const { prisma, tenantConfig, aggregation, callQueue, logger } = buildDeps()
    prisma.call.findUnique.mockResolvedValue(null)
    prisma.call.upsert.mockResolvedValue({
      id: 'db-call-1',
      managerId: null,
      occurredAt: new Date('2026-03-20T10:00:00.000Z'),
      processingStatus: 'NEW',
      queueJobId: null,
      recordingUrl: 'https://example.com/call.mp3',
    })

    const service = new BitrixService(prisma, tenantConfig, aggregation, callQueue, logger)

    await service.handleWebhook(buildCallPayload(), 'expected-secret')

    expect(callQueue.enqueueProcessCall).toHaveBeenCalledWith('db-call-1')
    expect(prisma.call.update).toHaveBeenCalledWith({
      where: { id: 'db-call-1' },
      data: {
        processingStatus: 'QUEUED',
        queueJobId: 'job-1',
      },
    })
    expect(prisma.eventLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventKey: expect.any(String),
        }),
      }),
    )
  })

  it('does not enqueue processing again when the same call is already queued', async () => {
    const { prisma, tenantConfig, aggregation, callQueue, logger } = buildDeps()
    prisma.call.findUnique.mockResolvedValue({
      id: 'db-call-1',
      externalId: 'call-1',
      recordingUrl: 'https://example.com/call.mp3',
      processingStatus: 'QUEUED',
      queueJobId: 'job-1',
    })
    prisma.call.upsert.mockResolvedValue({
      id: 'db-call-1',
      managerId: null,
      occurredAt: new Date('2026-03-20T10:00:00.000Z'),
      processingStatus: 'QUEUED',
      queueJobId: 'job-1',
      recordingUrl: 'https://example.com/call.mp3',
    })

    const service = new BitrixService(prisma, tenantConfig, aggregation, callQueue, logger)

    await service.handleWebhook(buildCallPayload('call.updated'), 'expected-secret')

    expect(callQueue.enqueueProcessCall).not.toHaveBeenCalled()
    expect(prisma.call.update).not.toHaveBeenCalled()
  })

  it('applies repeated deal.updated events with the same externalId when payload changes', async () => {
    const { prisma, tenantConfig, aggregation, callQueue, logger } = buildDeps()
    prisma.deal.upsert
      .mockResolvedValueOnce({ id: 'db-deal-1' })
      .mockResolvedValueOnce({ id: 'db-deal-1' })

    const service = new BitrixService(prisma, tenantConfig, aggregation, callQueue, logger)

    await expect(service.handleWebhook(buildDealPayload(), 'expected-secret')).resolves.toEqual({
      status: 'ok',
      entity: 'deal',
    })
    await expect(
      service.handleWebhook(
        buildDealPayload({
          title: 'Updated title',
          amount: '2500',
          stageId: 'WON',
          modifiedAt: '2026-03-20T12:00:00.000Z',
        }),
        'expected-secret',
      ),
    ).resolves.toEqual({
      status: 'ok',
      entity: 'deal',
    })

    expect(prisma.deal.upsert).toHaveBeenCalledTimes(2)
    expect(prisma.dealStageHistory.create).toHaveBeenCalledTimes(2)
    expect(prisma.eventLog.create).toHaveBeenCalledTimes(2)
  })

  it('treats a true retry of call.updated as duplicate when payload is unchanged', async () => {
    const { prisma, tenantConfig, aggregation, callQueue, logger } = buildDeps()
    prisma.call.findUnique.mockResolvedValue(null)
    prisma.call.upsert.mockResolvedValue({
      id: 'db-call-1',
      managerId: null,
      occurredAt: new Date('2026-03-20T10:00:00.000Z'),
      processingStatus: 'NEW',
      queueJobId: null,
      recordingUrl: 'https://example.com/call.mp3',
    })

    const service = new BitrixService(prisma, tenantConfig, aggregation, callQueue, logger)

    await expect(service.handleWebhook(buildCallPayload('call.updated'), 'expected-secret')).resolves.toEqual({
      status: 'ok',
      entity: 'call',
    })
    await expect(service.handleWebhook(buildCallPayload('call.updated'), 'expected-secret')).resolves.toEqual({
      status: 'duplicate',
    })

    expect(prisma.call.upsert).toHaveBeenCalledTimes(1)
  })

  it('applies repeated call.updated events with the same externalId when payload changes', async () => {
    const { prisma, tenantConfig, aggregation, callQueue, logger } = buildDeps()
    prisma.call.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'db-call-1',
        externalId: 'call-1',
        recordingUrl: 'https://example.com/call.mp3',
        processingStatus: 'DONE',
        queueJobId: 'job-1',
      })
    prisma.call.upsert
      .mockResolvedValueOnce({
        id: 'db-call-1',
        managerId: null,
        occurredAt: new Date('2026-03-20T10:00:00.000Z'),
        processingStatus: 'NEW',
        queueJobId: null,
        recordingUrl: 'https://example.com/call.mp3',
      })
      .mockResolvedValueOnce({
        id: 'db-call-1',
        managerId: null,
        occurredAt: new Date('2026-03-20T10:00:00.000Z'),
        processingStatus: 'DONE',
        queueJobId: 'job-1',
        recordingUrl: 'https://example.com/call-v2.mp3',
      })

    const service = new BitrixService(prisma, tenantConfig, aggregation, callQueue, logger)

    await expect(service.handleWebhook(buildCallPayload('call.updated'), 'expected-secret')).resolves.toEqual({
      status: 'ok',
      entity: 'call',
    })
    await expect(
      service.handleWebhook(buildCallPayload('call.updated', 'https://example.com/call-v2.mp3'), 'expected-secret'),
    ).resolves.toEqual({
      status: 'ok',
      entity: 'call',
    })

    expect(prisma.call.upsert).toHaveBeenCalledTimes(2)
    expect(prisma.eventLog.create).toHaveBeenCalledTimes(2)
  })

  it('does not enqueue processing again when the same call is already done and recording url is unchanged', async () => {
    const { prisma, tenantConfig, aggregation, callQueue, logger } = buildDeps()
    prisma.call.findUnique.mockResolvedValue({
      id: 'db-call-1',
      externalId: 'call-1',
      recordingUrl: 'https://example.com/call.mp3',
      processingStatus: 'DONE',
      queueJobId: 'job-1',
    })
    prisma.call.upsert.mockResolvedValue({
      id: 'db-call-1',
      managerId: null,
      occurredAt: new Date('2026-03-20T10:00:00.000Z'),
      processingStatus: 'DONE',
      queueJobId: 'job-1',
      recordingUrl: 'https://example.com/call.mp3',
    })

    const service = new BitrixService(prisma, tenantConfig, aggregation, callQueue, logger)

    await service.handleWebhook(buildCallPayload('call.recording.ready'), 'expected-secret')

    expect(callQueue.enqueueProcessCall).not.toHaveBeenCalled()
    expect(prisma.call.update).not.toHaveBeenCalled()
  })

  it('re-enqueues processing when a failed call is retried', async () => {
    const { prisma, tenantConfig, aggregation, callQueue, logger } = buildDeps()
    prisma.call.findUnique.mockResolvedValue({
      id: 'db-call-1',
      externalId: 'call-1',
      recordingUrl: 'https://example.com/call.mp3',
      processingStatus: 'FAILED',
      queueJobId: 'job-0',
    })
    prisma.call.upsert.mockResolvedValue({
      id: 'db-call-1',
      managerId: null,
      occurredAt: new Date('2026-03-20T10:00:00.000Z'),
      processingStatus: 'FAILED',
      queueJobId: 'job-0',
      recordingUrl: 'https://example.com/call.mp3',
    })

    const service = new BitrixService(prisma, tenantConfig, aggregation, callQueue, logger)

    await service.handleWebhook(buildCallPayload('call.retry'), 'expected-secret')

    expect(callQueue.enqueueProcessCall).toHaveBeenCalledWith('db-call-1')
    expect(prisma.call.update).toHaveBeenCalledWith({
      where: { id: 'db-call-1' },
      data: {
        processingStatus: 'QUEUED',
        queueJobId: 'job-1',
      },
    })
  })

  it('does not mark the call as queued when call processing is disabled', async () => {
    const { prisma, tenantConfig, aggregation, callQueue, logger } = buildDeps()
    prisma.call.findUnique.mockResolvedValue(null)
    prisma.call.upsert.mockResolvedValue({
      id: 'db-call-1',
      managerId: null,
      occurredAt: new Date('2026-03-20T10:00:00.000Z'),
      processingStatus: 'NEW',
      queueJobId: null,
      recordingUrl: 'https://example.com/call.mp3',
    })
    callQueue.enqueueProcessCall.mockResolvedValue(null)

    const service = new BitrixService(prisma, tenantConfig, aggregation, callQueue, logger)

    await service.handleWebhook(buildCallPayload(), 'expected-secret')

    expect(callQueue.enqueueProcessCall).toHaveBeenCalledWith('db-call-1')
    expect(prisma.call.update).not.toHaveBeenCalled()
  })
})
