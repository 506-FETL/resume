import { startCollaborationLeaseMonitor } from '../lease'
import { renewCollaborationCommentSession } from '../service'
import type {
  CollaborationSessionSetState,
  CollaborationSessionStore,
  PreparedGuestSession,
} from '../types'
import { cleanupSession } from './lifecycle'
import type { SessionRuntime } from './types'

export const startGuestLease = (
  runtime: SessionRuntime,
  set: CollaborationSessionSetState,
  get: () => CollaborationSessionStore,
  prepared: PreparedGuestSession,
) => {
  runtime.stopLeaseMonitor?.()

  runtime.stopLeaseMonitor = startCollaborationLeaseMonitor({
    renew: async () => {
      const commentAccess = await renewCollaborationCommentSession({
        sessionId: prepared.sessionId,
        resumeId: prepared.resumeId,
        protocolVersion: prepared.authorization.commentAccess.protocolVersion,
        memberLeaseId:
          prepared.authorization.commentAccess.memberLeaseId ?? undefined,
      })

      if (
        prepared.generation === runtime.generation &&
        get().phase === 'connected' &&
        get().role === 'guest'
      ) {
        set({ commentAccess })
      }
    },
    onRevoked: (error) => {
      console.warn('[collaboration] guest lease revoked:', error)

      cleanupSession(runtime, set, get, {
        generation: prepared.generation,
        remote: true,
      })
    },
    onTransientError: (error) => {
      console.warn(
        '[collaboration] guest lease renewal failed temporarily:',
        error,
      )
    },
  })
}
