import { create } from 'zustand'
import { createInitialCollaborationSessionState } from '../state'
import type { CollaborationSessionStore } from '../types'
import { createGuestActions } from './guest-actions'
import { createHostActions } from './host-actions'
import { cleanupSession, setPhase } from './lifecycle'
import { createStopAction } from './stop-action'
import type { SessionRuntime } from './types'

export const useCollaborationStore = create<CollaborationSessionStore>()((
  set,
  get,
) => {
  const runtime: SessionRuntime = {
    generation: 0,
    richTextStore: null,
    stopLeaseMonitor: null,
    pendingGuestMembership: null,
  }

  return {
    ...createInitialCollaborationSessionState(),
    ...createHostActions(runtime, set, get),
    ...createGuestActions(runtime, set, get),
    ...createStopAction(runtime, set, get),
    markInviteAuthenticating: () => {
      setPhase(set, 'authenticating', {
        error: null,
        shareEndedByRemote: false,
      })
    },
    handleRemoteShareEnd: () => {
      const state = get()

      if (state.role !== 'guest') {
        return
      }

      cleanupSession(runtime, set, get, {
        generation: runtime.generation,
        remote: true,
      })
    },
    acknowledgeRemoteShareEnd: () => {
      if (get().shareEndedByRemote) {
        set({ shareEndedByRemote: false })
      }
    },
  }
})
