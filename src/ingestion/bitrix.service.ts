import { Injectable, UnauthorizedException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { AppLogger } from '../logger/logger.service'
import { PrismaService } from '../prisma/prisma.service'
import { AggregationService } from '../aggregation/aggregation.service'
import { TenantConfigService } from '../config/tenant-config.service'
import { CallQueueService } from '../queue/call-queue.service'
import { buildBitrixEventKey } from './bitrix-event-key'

type ExistingCallProcessingState = {
  id: string
  recordingUrl?: string | null
  processingStatus?: string | null
  queueJobId?: string | null
}

@Injectable()
export class BitrixService {
  constructor(
    private prisma: PrismaService,
    private tenantConfig: TenantConfigService,
    private aggregation: AggregationService,
    private callQueue: CallQueueService,
    private logger: AppLogger,
  ) {}

  async handleWebhook(payload: Record<string, any>, secretHeader?: string) {
    const config = await this.tenantConfig.getConfig()
    if (!secretHeader || secretHeader !== config.webhookSecret) {
      throw new UnauthorizedException('Invalid webhook secret')
    }

    const eventType = this.extractEventType(payload)
    const externalId = this.extractExternalId(payload)

    if (!externalId) {
      this.logger.warn({ msg: 'Webhook missing externalId', eventType })
      return { status: 'ignored', reason: 'missing externalId' }
    }

    const eventKey = buildBitrixEventKey(eventType, String(externalId), payload)
    let eventLogId: string

    try {
      const eventLog = await this.prisma.eventLog.create({
        data: {
          eventKey,
          eventType,
          externalId: String(externalId),
          payload,
        },
      })
      eventLogId = eventLog.id
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        return { status: 'duplicate' }
      }
      throw error
    }

    const entityType = this.resolveEntityType(eventType, payload)

    if (entityType === 'deal') {
      const result = await this.processDeal(payload, config)
      if (result?.date) {
        await this.aggregation.recomputeForDate(result.date, result.managerId)
      }
      await this.markProcessed(eventLogId)
      return { status: 'ok', entity: 'deal' }
    }

    if (entityType === 'call') {
      const result = await this.processCall(payload, config)
      if (result?.date) {
        await this.aggregation.recomputeForDate(result.date, result.managerId)
      }
      await this.markProcessed(eventLogId)
      return { status: 'ok', entity: 'call' }
    }

    await this.markProcessed(eventLogId)
    return { status: 'ignored', reason: 'unknown event type' }
  }

  private async markProcessed(eventLogId: string) {
    await this.prisma.eventLog.update({
      where: { id: eventLogId },
      data: { processedAt: new Date() },
    })
  }

  private async processDeal(payload: Record<string, any>, config: { funnelStageMapping: Prisma.JsonValue; managerMapping: Prisma.JsonValue }) {
    const dealData = payload?.data?.FIELDS ?? payload?.data ?? payload?.deal ?? payload
    const rawId = dealData?.ID ?? dealData?.id ?? dealData?.DEAL_ID
    if (!rawId) return null

    const externalId = String(rawId)
    const stageRaw = dealData?.STAGE_ID ?? dealData?.stageId ?? dealData?.stage
    const stageKey = stageRaw ? this.mapStage(String(stageRaw), config.funnelStageMapping) : 'UNKNOWN'
    const amount = this.parseNumber(dealData?.OPPORTUNITY ?? dealData?.amount)
    const title = dealData?.TITLE ?? dealData?.title
    const managerExternalId = dealData?.ASSIGNED_BY_ID ?? dealData?.managerId ?? dealData?.ownerId
    const managerId = await this.resolveManagerId(String(managerExternalId ?? ''), config.managerMapping)
    const changedAt = this.parseDate(dealData?.DATE_MODIFY ?? dealData?.DATE_UPDATE ?? payload?.timestamp) ?? new Date()

    const deal = await this.prisma.deal.upsert({
      where: { externalId },
      update: {
        title,
        amount,
        stageKey,
        stageRaw: stageRaw ? String(stageRaw) : null,
        managerId,
      },
      create: {
        externalId,
        title,
        amount,
        stageKey,
        stageRaw: stageRaw ? String(stageRaw) : null,
        managerId,
      },
    })

    await this.prisma.dealStageHistory.create({
      data: {
        dealId: deal.id,
        managerId,
        stageKey,
        stageRaw: stageRaw ? String(stageRaw) : null,
        amount,
        changedAt,
      },
    })

    return { date: changedAt, managerId }
  }

  private async processCall(payload: Record<string, any>, config: { managerMapping: Prisma.JsonValue }) {
    const callData = payload?.data?.FIELDS ?? payload?.data ?? payload?.call ?? payload
    const rawId = callData?.CALL_ID ?? callData?.ID ?? callData?.id
    if (!rawId) return null

    const externalId = String(rawId)
    const existingCall = await this.prisma.call.findUnique({
      where: { externalId },
      select: {
        id: true,
        recordingUrl: true,
        processingStatus: true,
        queueJobId: true,
      },
    })
    const managerExternalId = callData?.ASSIGNED_BY_ID ?? callData?.managerId ?? callData?.USER_ID
    const managerId = await this.resolveManagerId(String(managerExternalId ?? ''), config.managerMapping)
    const occurredAt = this.parseDate(callData?.CALL_START_DATE ?? callData?.DATE_START ?? callData?.timestamp) ?? new Date()
    const durationSec = this.parseNumber(callData?.DURATION ?? callData?.duration)
    const recordingUrl = callData?.RECORDING_URL ?? callData?.recordingUrl
    const recordingProvider = callData?.RECORDING_PROVIDER ?? callData?.recordingProvider

    const duration = durationSec !== undefined ? Math.trunc(durationSec) : null

    const call = await this.prisma.call.upsert({
      where: { externalId },
      update: {
        managerId,
        occurredAt,
        durationSec: duration,
        recordingUrl,
        recordingProvider,
      },
      create: {
        externalId,
        managerId,
        occurredAt,
        durationSec: duration,
        recordingUrl,
        recordingProvider,
      },
    })

    if (this.shouldEnqueueCallProcessing(existingCall, recordingUrl)) {
      const job = await this.callQueue.enqueueProcessCall(call.id)
      if (job) {
        await this.prisma.call.update({
          where: { id: call.id },
          data: {
            processingStatus: 'QUEUED',
            queueJobId: String(job.id),
          },
        })
      }
    }

    return { date: occurredAt, managerId }
  }

  private shouldEnqueueCallProcessing(
    existingCall: ExistingCallProcessingState | null,
    nextRecordingUrl: string | undefined,
  ) {
    if (!nextRecordingUrl) {
      return false
    }

    if (!existingCall) {
      return true
    }

    if (existingCall.recordingUrl !== nextRecordingUrl) {
      return true
    }

    if (existingCall.processingStatus === 'FAILED') {
      return true
    }

    return !['QUEUED', 'PROCESSING', 'DONE'].includes(existingCall.processingStatus ?? '')
  }

  private extractEventType(payload: Record<string, any>) {
    return (
      payload?.event ??
      payload?.eventType ??
      payload?.event_type ??
      payload?.type ??
      'unknown'
    )
  }

  private extractExternalId(payload: Record<string, any>) {
    return (
      payload?.externalId ??
      payload?.id ??
      payload?.data?.ID ??
      payload?.data?.id ??
      payload?.data?.DEAL_ID ??
      payload?.data?.CALL_ID ??
      payload?.data?.FIELDS?.ID ??
      payload?.data?.FIELDS?.CALL_ID
    )
  }

  private resolveEntityType(eventType: string, payload: Record<string, any>) {
    const lower = eventType.toLowerCase()
    if (lower.includes('deal') || payload?.deal || payload?.data?.DEAL_ID || payload?.data?.FIELDS?.DEAL_ID) {
      return 'deal'
    }
    if (lower.includes('call') || payload?.call || payload?.data?.CALL_ID || payload?.data?.FIELDS?.CALL_ID) {
      return 'call'
    }
    return 'unknown'
  }

  private mapStage(raw: string, mapping: Prisma.JsonValue) {
    const map = (mapping ?? {}) as Record<string, string>
    return map[raw] ?? raw ?? 'UNKNOWN'
  }

  private async resolveManagerId(raw: string, mapping: Prisma.JsonValue) {
    if (!raw) return undefined
    const map = (mapping ?? {}) as Record<string, string>
    const mapped = map[raw]
    if (mapped) {
      const existing = await this.prisma.manager.findUnique({ where: { id: mapped } })
      if (existing) return existing.id
      const created = await this.prisma.manager.create({
        data: { id: mapped, name: `Manager ${mapped}`, externalId: raw },
      })
      return created.id
    }

    const manager = await this.prisma.manager.upsert({
      where: { externalId: raw },
      update: {},
      create: { externalId: raw, name: `Manager ${raw}` },
    })
    return manager.id
  }

  private parseNumber(value: any) {
    if (value === undefined || value === null || value === '') return undefined
    const num = Number(value)
    return Number.isFinite(num) ? num : undefined
  }

  private parseDate(value: any) {
    if (!value) return null
    const date = new Date(value)
    return Number.isNaN(date.valueOf()) ? null : date
  }

  private isUniqueViolation(error: unknown) {
    return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'P2002')
  }
}
