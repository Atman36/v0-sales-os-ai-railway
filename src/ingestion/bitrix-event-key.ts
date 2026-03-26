import { createHash } from 'node:crypto'

type JsonLike = null | boolean | number | string | JsonLike[] | { [key: string]: JsonLike }

export function buildBitrixEventKey(eventType: string, externalId: string, payload: Record<string, unknown>) {
  // Keep this serializer aligned with PostgreSQL jsonb::text because the migration
  // backfills historical rows with md5(payload::text).
  const normalizedPayload = stableStringify(payload as JsonLike)
  const fingerprint = createHash('md5').update(normalizedPayload).digest('hex')

  return `${eventType}:${externalId}:${fingerprint}`
}

function stableStringify(value: JsonLike): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(', ')}]`
  }

  const keys = Object.keys(value).sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}: ${stableStringify(value[key])}`).join(', ')}}`
}
