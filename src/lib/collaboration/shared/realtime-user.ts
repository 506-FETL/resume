interface PresenceLike {
  [key: string]: unknown
  userId?: unknown
  metadata?: {
    userId?: unknown
    [key: string]: unknown
  } | null
}

export function createRealtimeUserId(): number {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.getRandomValues === 'function'
  ) {
    return crypto.getRandomValues(new Uint32Array(1))[0]
  }

  return Date.now() + Math.floor(Math.random() * 1000)
}

export function getPresenceUserId(presence: PresenceLike): number | null {
  const rawUserId = presence.metadata?.userId ?? presence.userId

  if (typeof rawUserId === 'number' && Number.isFinite(rawUserId)) {
    return rawUserId
  }

  if (typeof rawUserId === 'string') {
    const parsedUserId = Number(rawUserId)

    return Number.isFinite(parsedUserId) ? parsedUserId : null
  }

  return null
}
