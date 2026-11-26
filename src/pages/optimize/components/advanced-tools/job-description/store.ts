import type { JobDescriptionToolSession } from './const'
import { create } from 'zustand'
import useUserStore from '@/store/user'
import { createInitialJobDescriptionToolSession } from './const'

const storageKey = 'optimize-job-description-tool-storage'
const pending = new Set<string>()
const timers = new Map<string, ReturnType<typeof setTimeout>>()

export const initialSession = createInitialJobDescriptionToolSession()

interface JobDescriptionStore {
  sessions: Record<string, JobDescriptionToolSession>
  load: (key: string, legacyKey?: string) => void
  update: (
    key: string,
    changes: Partial<JobDescriptionToolSession>,
    persist?: 'draft' | 'stream' | 'now',
  ) => void
}

function readSession(
  key: string,
  legacyKey?: string,
): JobDescriptionToolSession {
  try {
    const stored = localStorage.getItem(`${storageKey}:${key}`)

    const raw = stored
      ? JSON.parse(stored)
      : legacyKey
        ? JSON.parse(localStorage.getItem(storageKey) ?? 'null')?.state
            ?.sessions?.[legacyKey]
        : null

    if (!raw || typeof raw !== 'object') return initialSession

    return {
      ...initialSession,
      ...raw,
      analyzing: false,
      analysisState: {
        ...initialSession.analysisState,
        ...raw.analysisState,
        logs: raw.analysisState?.logs ?? {},
      },
    }
  } catch {
    return initialSession
  }
}

function flushSession(key: string) {
  clearTimeout(timers.get(key))
  timers.delete(key)

  if (!pending.delete(key)) return

  const session = useJobDescriptionToolStore.getState().sessions[key]

  try {
    localStorage.setItem(`${storageKey}:${key}`, JSON.stringify(session))
  } catch {
    // 浏览器空间耗尽时，当前标签页仍保留可编辑的输入与结果。
  }
}

export function flushJobDescriptionSessions() {
  for (const key of pending) flushSession(key)
}

const useJobDescriptionToolStore = create<JobDescriptionStore>()(
  (set, get) => ({
    sessions: {},
    load: (key, legacyKey) => {
      const existing = get().sessions[key]

      if (existing && (existing !== initialSession || !legacyKey)) return

      const session = readSession(key, legacyKey)

      set((state) => ({ sessions: { ...state.sessions, [key]: session } }))
    },
    update: (key, changes, persist = 'now') => {
      const session = get().sessions[key] ?? initialSession

      set((state) => ({
        sessions: { ...state.sessions, [key]: { ...session, ...changes } },
      }))

      pending.add(key)

      if (persist === 'now') flushSession(key)
      if (persist === 'draft') {
        clearTimeout(timers.get(key))

        timers.set(
          key,
          setTimeout(() => flushSession(key), 250),
        )
      }
    },
  }),
)

useUserStore.subscribe((state, previous) => {
  const owner = previous.currentUser?.id

  if (!owner || state.currentUser?.id === owner) return

  const { sessions, update } = useJobDescriptionToolStore.getState()

  for (const [key, session] of Object.entries(sessions)) {
    if (session.analyzing && key.startsWith(`${owner}:`))
      update(key, { analyzing: false })
  }
})

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushJobDescriptionSessions)

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) flushJobDescriptionSessions()
  })
}

export default useJobDescriptionToolStore
