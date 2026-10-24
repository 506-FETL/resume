import type { JobDescriptionComparisonResult } from './types'
import type { AnalysisState } from '@/pages/optimize/types'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  createInitialJobDescriptionAnalysisState,
  createInitialJobDescriptionToolSession,
} from './const'

interface JobDescriptionToolStore {
  sessions: Record<
    string,
    ReturnType<typeof createInitialJobDescriptionToolSession>
  >
  setAnalysisError: (sessionKey: string, error: string | null) => void
  setAnalysisOpen: (sessionKey: string, open: boolean) => void
  setAnalysisState: (sessionKey: string, state: AnalysisState) => void
  setAnalyzing: (sessionKey: string, analyzing: boolean) => void
  setJobDescription: (sessionKey: string, value: string) => void
  setResult: (
    sessionKey: string,
    result: JobDescriptionComparisonResult | null,
  ) => void
  updateAnalysisLog: (
    sessionKey: string,
    key: string,
    value: string,
    append?: boolean,
  ) => void
  updateAnalysisState: (
    sessionKey: string,
    partial: Partial<AnalysisState>,
  ) => void
}

function getSession(
  sessions: Record<
    string,
    ReturnType<typeof createInitialJobDescriptionToolSession>
  >,
  sessionKey: string,
) {
  return sessions[sessionKey] ?? createInitialJobDescriptionToolSession()
}

function normalizeAnalysisState(value: unknown): AnalysisState {
  const initialState = createInitialJobDescriptionAnalysisState()

  if (!value || typeof value !== 'object') {
    return initialState
  }

  const analysisState = value as Partial<AnalysisState>

  return {
    ...initialState,
    ...analysisState,
    logs: analysisState.logs ?? {},
  }
}

function normalizePersistedSession(value: unknown) {
  const initialSession = createInitialJobDescriptionToolSession()

  if (!value || typeof value !== 'object') {
    return initialSession
  }

  const session = value as Partial<
    ReturnType<typeof createInitialJobDescriptionToolSession>
  >

  return {
    ...initialSession,
    ...session,
    analyzing: false,
    analysisState: normalizeAnalysisState(session.analysisState),
  }
}

function updateSession(
  sessions: Record<
    string,
    ReturnType<typeof createInitialJobDescriptionToolSession>
  >,
  sessionKey: string,
  updater: (
    session: ReturnType<typeof createInitialJobDescriptionToolSession>,
  ) => ReturnType<typeof createInitialJobDescriptionToolSession>,
) {
  const session = getSession(sessions, sessionKey)

  return {
    ...sessions,
    [sessionKey]: updater(session),
  }
}

const useJobDescriptionToolStore = create<JobDescriptionToolStore>()(
  persist(
    (set) => ({
      sessions: {},
      setJobDescription: (sessionKey, value) => {
        set((state) => ({
          sessions: updateSession(state.sessions, sessionKey, (session) => ({
            ...session,
            jobDescription: value,
          })),
        }))
      },
      setResult: (sessionKey, result) => {
        set((state) => ({
          sessions: updateSession(state.sessions, sessionKey, (session) => ({
            ...session,
            result,
          })),
        }))
      },
      setAnalyzing: (sessionKey, analyzing) => {
        set((state) => ({
          sessions: updateSession(state.sessions, sessionKey, (session) => ({
            ...session,
            analyzing,
          })),
        }))
      },
      setAnalysisOpen: (sessionKey, open) => {
        set((state) => ({
          sessions: updateSession(state.sessions, sessionKey, (session) => ({
            ...session,
            analysisOpen: open,
          })),
        }))
      },
      setAnalysisError: (sessionKey, error) => {
        set((state) => ({
          sessions: updateSession(state.sessions, sessionKey, (session) => ({
            ...session,
            analysisError: error,
          })),
        }))
      },
      setAnalysisState: (sessionKey, analysisState) => {
        set((state) => ({
          sessions: updateSession(state.sessions, sessionKey, (session) => ({
            ...session,
            analysisState,
          })),
        }))
      },
      updateAnalysisState: (sessionKey, partial) => {
        set((state) => ({
          sessions: updateSession(state.sessions, sessionKey, (session) => ({
            ...session,
            analysisState: {
              ...session.analysisState,
              ...partial,
            },
          })),
        }))
      },
      updateAnalysisLog: (sessionKey, key, value, append = false) => {
        set((state) => {
          const session = getSession(state.sessions, sessionKey)
          const currentValue = session.analysisState.logs[key]

          return {
            sessions: updateSession(
              state.sessions,
              sessionKey,
              (currentSession) => ({
                ...currentSession,
                analysisState: {
                  ...currentSession.analysisState,
                  logs: {
                    ...currentSession.analysisState.logs,
                    [key]:
                      append && currentValue
                        ? `${currentValue}\n${value}`
                        : value,
                  },
                },
              }),
            ),
          }
        })
      },
    }),
    {
      name: 'optimize-job-description-tool-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sessions: state.sessions,
      }),
      version: 1,
      merge: (persistedState, currentState) => {
        const persistedSessions =
          (persistedState as Partial<JobDescriptionToolStore> | undefined)
            ?.sessions ?? {}
        const normalizedSessions = Object.fromEntries(
          Object.entries(persistedSessions).map(([sessionKey, session]) => [
            sessionKey,
            normalizePersistedSession(session),
          ]),
        )

        return {
          ...currentState,
          sessions: normalizedSessions,
        }
      },
    },
  ),
)

export function getJobDescriptionToolSession(sessionKey: string) {
  return (
    useJobDescriptionToolStore.getState().sessions[sessionKey] ??
    createInitialJobDescriptionToolSession()
  )
}

export function resetJobDescriptionToolAnalysis(sessionKey: string) {
  const current = getJobDescriptionToolSession(sessionKey)

  useJobDescriptionToolStore.getState().setAnalysisState(sessionKey, {
    ...createInitialJobDescriptionAnalysisState(),
    status: 'sending',
    logs: {
      send: '正在上传当前简历和岗位描述...',
    },
  })
  useJobDescriptionToolStore
    .getState()
    .setJobDescription(sessionKey, current.jobDescription)
  useJobDescriptionToolStore.getState().setResult(sessionKey, null)
  useJobDescriptionToolStore.getState().setAnalysisError(sessionKey, null)
  useJobDescriptionToolStore.getState().setAnalysisOpen(sessionKey, true)
  useJobDescriptionToolStore.getState().setAnalyzing(sessionKey, true)
}

export default useJobDescriptionToolStore
