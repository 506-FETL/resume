import type { ResumeSnapshot } from './types'

function trimToNull(value: string | null | undefined) {
  const nextValue = value?.trim()

  return nextValue || null
}

function sanitizeSnapshot(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeSnapshot(item))
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, sanitizeSnapshot(item)]),
    )
  }

  return value
}

function sortSnapshotKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortSnapshotKeys(item))
  }

  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = sortSnapshotKeys((value as Record<string, unknown>)[key])

        return result
      }, {})
  }

  return value
}

function stableSerializeSnapshot(snapshot: ResumeSnapshot) {
  return JSON.stringify(sortSnapshotKeys(sanitizeSnapshot(snapshot)))
}

export async function createResumeSnapshotHash(snapshot: ResumeSnapshot) {
  const content = stableSerializeSnapshot(snapshot)

  if (!globalThis.crypto?.subtle) {
    return content
  }

  const encoded = new TextEncoder().encode(content)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded)

  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
}

export { trimToNull }
