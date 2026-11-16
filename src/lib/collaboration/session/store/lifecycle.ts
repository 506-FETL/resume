import useResumeStore from '@/store/resume/form'
import { toast } from 'sonner'
import {
  createCollaborationPhaseState,
  createStoppedSessionState,
} from '../state'
import { clearStoredSession } from '../storage'
import type {
  CollaborationSessionSetState,
  CollaborationSessionStore,
} from '../types'
import {
  getCurrentPendingGuestMembership,
  retirePendingGuestMembership,
} from './membership'
import type { CleanupSessionOptions, SessionRuntime } from './types'

export const setPhase = (
  set: CollaborationSessionSetState,
  phase: Parameters<typeof createCollaborationPhaseState>[0],
  overrides: Parameters<typeof createCollaborationPhaseState>[1] = {},
) => {
  set(createCollaborationPhaseState(phase, overrides))
}

export const cleanupSession = (
  runtime: SessionRuntime,
  set: CollaborationSessionSetState,
  get: () => CollaborationSessionStore,
  { generation, remote, error }: CleanupSessionOptions,
) => {
  if (generation !== runtime.generation) {
    return false
  }

  const state = get()

  const pendingMembership = getCurrentPendingGuestMembership(
    runtime,
    generation,
    state,
  )

  if (pendingMembership) {
    retirePendingGuestMembership(runtime, pendingMembership)
  }

  runtime.generation += 1
  runtime.stopLeaseMonitor?.()
  runtime.stopLeaseMonitor = null

  const docManager = useResumeStore.getState().docManager

  if (
    docManager &&
    (!state.sessionId ||
      docManager.getCollaborationSessionId() === state.sessionId)
  ) {
    try {
      docManager.disableCollaboration()
    } catch (cleanupError) {
      console.warn('[collaboration] Automerge cleanup failed:', cleanupError)
    }
  }

  runtime.richTextStore?.getState().stop()

  if (state.sessionId && state.resumeId && state.self) {
    clearStoredSession(state.sessionId, state.resumeId, state.self.userId)
  }

  set(
    createStoppedSessionState({
      phase: remote ? 'ended' : error ? 'error' : 'idle',
      error: error ?? null,
      shareEndedByRemote: remote,
    }),
  )

  if (remote) {
    toast.warning('协作已结束', { description: '发起者已关闭实时协作' })
  }

  return true
}
