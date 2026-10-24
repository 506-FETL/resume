const STORAGE_KEY = 'resume:collaboration:sessions'

type StoredRole = 'host' | 'guest'

interface StoredSession {
  sessionId: string
  resumeId: string
  userId: string
  role: StoredRole
}

function isSupported() {
  return typeof window !== 'undefined' && typeof sessionStorage !== 'undefined'
}

function readStore(): StoredSession[] {
  if (!isSupported()) {
    return []
  }

  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)

    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw)

    if (Array.isArray(parsed)) {
      return parsed.filter(
        (entry): entry is StoredSession =>
          entry &&
          typeof entry.sessionId === 'string' &&
          typeof entry.resumeId === 'string' &&
          typeof entry.userId === 'string' &&
          (entry.role === 'host' || entry.role === 'guest'),
      )
    }

    return []
  } catch {
    return []
  }
}

function writeStore(entries: StoredSession[]) {
  if (!isSupported()) {
    return
  }

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // ignore quota errors
  }
}

export function rememberSessionRole(entry: StoredSession) {
  const entries = readStore()

  const filtered = entries.filter(
    (item) =>
      item.sessionId !== entry.sessionId ||
      item.resumeId !== entry.resumeId ||
      item.userId !== entry.userId,
  )

  filtered.push(entry)
  writeStore(filtered)
}

export function getStoredSessionRole(
  sessionId: string,
  resumeId: string,
  userId: string,
): StoredRole | null {
  const entries = readStore()

  const matched = entries.find(
    (item) =>
      item.sessionId === sessionId &&
      item.resumeId === resumeId &&
      item.userId === userId,
  )

  return matched?.role ?? null
}

export function clearStoredSession(
  sessionId: string,
  resumeId: string,
  userId: string,
) {
  const entries = readStore()

  const filtered = entries.filter(
    (item) =>
      item.sessionId !== sessionId ||
      item.resumeId !== resumeId ||
      item.userId !== userId,
  )

  writeStore(filtered)
}
