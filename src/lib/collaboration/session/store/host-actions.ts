import { toast } from 'sonner'
import { createCollaborationSessionId } from '../../shared'
import type {
  CollaborationSessionSetState,
  CollaborationSessionStore,
  StartShareParams,
} from '../types'
import { getErrorMessage } from './guards'
import { createHostConnector } from './host-connection'
import type {
  ActiveHostStartOperation,
  HostStartRuntime,
  PendingHostAttempt,
  SessionRuntime,
} from './types'

export function createHostActions(
  runtime: SessionRuntime,
  set: CollaborationSessionSetState,
  get: () => CollaborationSessionStore,
): Pick<CollaborationSessionStore, 'startSharing' | 'resumeHosting'> {
  const host: HostStartRuntime = { pendingAttempt: null, activeOperation: null }
  const connectHostSession = createHostConnector(runtime, host, set, get)

  const executeStartSharing = async ({
    resumeId,
    userId,
    userName,
  }: StartShareParams) => {
    if (get().isConnecting) {
      return
    }

    if (get().sessionId || get().isSharing) {
      await get().stopSharing({ silent: true })
    }

    const retryableAttempt =
      host.pendingAttempt?.resumeId === resumeId &&
      host.pendingAttempt.userId === userId &&
      host.pendingAttempt.status === 'retryable'
        ? host.pendingAttempt
        : null

    const attempt: PendingHostAttempt = retryableAttempt
      ? { ...retryableAttempt, status: 'active' }
      : {
          sessionId: createCollaborationSessionId(),
          resumeId,
          userId,
          ownerGeneration: runtime.generation,
          status: 'active',
        }

    host.pendingAttempt = attempt

    try {
      await connectHostSession(
        {
          sessionId: attempt.sessionId,
          resumeId,
          userId,
          userName,
        },
        {
          saveSnapshot: true,
          seedRichText: true,
          pendingAttempt: {
            sessionId: attempt.sessionId,
            resumeId: attempt.resumeId,
            userId: attempt.userId,
          },
        },
      )

      toast.success('已开启实时协作', {
        description: '现在可以将链接分享给他人了',
      })
    } catch (error) {
      toast.error(getErrorMessage(error, '开启协作失败'))

      throw error
    }
  }

  const runSerializedHostStart = (params: StartShareParams): Promise<void> => {
    const activeOperation = host.activeOperation

    if (activeOperation) {
      if (
        activeOperation.resumeId === params.resumeId &&
        activeOperation.userId === params.userId
      ) {
        return activeOperation.promise
      }

      return activeOperation.promise
        .catch(() => undefined)
        .then(() => runSerializedHostStart(params))
    }

    let operation: ActiveHostStartOperation

    const promise = executeStartSharing(params).finally(() => {
      if (host.activeOperation === operation) {
        host.activeOperation = null
      }
    })

    operation = {
      resumeId: params.resumeId,
      userId: params.userId,
      promise,
    }

    host.activeOperation = operation

    return promise
  }

  return {
    startSharing: runSerializedHostStart,
    resumeHosting: async (params) => {
      if (get().isConnecting && get().phase !== 'authenticating') {
        return
      }

      try {
        await connectHostSession(params, {
          saveSnapshot: false,
          seedRichText: false,
        })

        toast.success('已恢复实时协作', { description: '协作者可以继续编辑' })
      } catch (error) {
        toast.error(getErrorMessage(error, '恢复协作失败'))

        throw error
      }
    },
  }
}
