import type { ResumeSnapshot } from './types'

function trimToNull(value: string | null | undefined) {
  const nextValue = value?.trim()

  return nextValue || null
}

export function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortObjectKeys(item))
  }

  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = sortObjectKeys((value as Record<string, unknown>)[key])

        return result
      }, {})
  }

  return value
}

export function stableSerialize(value: unknown) {
  return JSON.stringify(sortObjectKeys(value))
}

export async function createResumeSnapshotHash(snapshot: ResumeSnapshot) {
  const content = stableSerialize(snapshot)

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
