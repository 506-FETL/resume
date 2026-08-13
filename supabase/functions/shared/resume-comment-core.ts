export interface LegacyResumeEntryIdInput {
  sectionKey: string
  collectionKey: string
  index: number
  value: unknown
}

function normalizeStableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(item => normalizeStableValue(item))
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return Object.fromEntries(
      Object.keys(record)
        .filter(key => record[key] !== undefined)
        .sort()
        .map(key => [key, normalizeStableValue(record[key])]),
    )
  }

  if (typeof value === 'number' && !Number.isFinite(value)) {
    return null
  }

  return value
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(normalizeStableValue(value))
}

function fnv1a32(value: string, seed: number): number {
  let hash = seed >>> 0

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }

  return hash
}

function toHex32(value: number): string {
  return value.toString(16).padStart(8, '0')
}

export function createLegacyResumeEntryId({
  sectionKey,
  collectionKey,
  index,
  value,
}: LegacyResumeEntryIdInput): string {
  const payload = stableStringify({
    collectionKey,
    index,
    sectionKey,
    value,
  })
  const first = fnv1a32(payload, 0x811C9DC5)
  const second = fnv1a32(payload, 0x9E3779B9)

  return `legacy_${toHex32(first)}${toHex32(second)}`
}
