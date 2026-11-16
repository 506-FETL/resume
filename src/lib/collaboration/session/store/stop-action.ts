import type { DocumentManager } from '@/lib/automerge'
import { COLLABORATION_CONTROL_ACK_TIMEOUT_MS } from '@/lib/automerge/shared/constants'
import useResumeStore from '@/store/resume/form'
import { toast } from 'sonner'
import { leaveCollaborationCommentSession } from '../service'
import { createStoppedSessionState } from '../state'
import type {
  CollaborationSessionSetState,
  CollaborationSessionStore,
} from '../types'
import { getErrorMessage } from './guards'
import { cleanupSession, setPhase } from './lifecycle'
import {
  clearPendingGuestMembership,
  getCurrentPendingGuestMembership,
  releaseGuestMembership,
  retirePendingGuestMembership,
} from './membership'
import type { ActiveStopOperation, SessionRuntime } from './types'

export async function broadcastShareEnded(docManager: DocumentManager) {
  let timeout: ReturnType<typeof setTimeout> | null = null

  try {
    await Promise.race([
      docManager.broadcastCollaborationEvent('share-ended', {
        reason: 'host_closed',
      }),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error('协作结束通知确认超时')),
          COLLABORATION_CONTROL_ACK_TIMEOUT_MS,
        )
      }),
    ])
  } finally {
    if (timeout) {
      clearTimeout(timeout)
    }
  }
}

export function createStopAction(
  runtime: SessionRuntime,
  set: CollaborationSessionSetState,
  get: () => CollaborationSessionStore,
): Pick<CollaborationSessionStore, 'stopSharing'> {
  let activeStopOperation: ActiveStopOperation | null = null

  return {
    stopSharing: async ({ silent, bestEffort } = {}) => {
      const state = get()

      if (!state.role || !state.sessionId || !state.resumeId) {
        // 邀请在鉴权未完成时离开编辑器，不应把全局 store
        // 永久留在 authenticating，否则后续普通简历会被误禁用协作入口。
        if (state.phase === 'authenticating') {
          set(createStoppedSessionState())
        }

        return
      }

      const generation = runtime.generation

      if (
        activeStopOperation?.generation === generation &&
        activeStopOperation.sessionId === state.sessionId
      ) {
        return activeStopOperation.promise
      }

      const sessionId = state.sessionId

      const isCurrentStop = () => {
        const current = get()

        return (
          runtime.generation === generation && current.sessionId === sessionId
        )
      }

      const stopPromise = (async () => {
        const docManager = useResumeStore.getState().docManager

        setPhase(set, 'stopping', { error: null })

        if (bestEffort) {
          if (state.role === 'guest') {
            const pendingMembership = getCurrentPendingGuestMembership(
              runtime,
              generation,
              state,
            )

            if (state.commentAccess) {
              releaseGuestMembership(
                {
                  sessionId: state.sessionId!,
                  resumeId: state.resumeId!,
                  protocolVersion: state.commentAccess.protocolVersion,
                  memberLeaseId: state.commentAccess.memberLeaseId ?? undefined,
                },
                { bestEffort: true },
              ).catch(() => undefined)
            } else if (pendingMembership) {
              // protocol 尚未确定时仍携带本次 member token，Edge 根据
              // session capability 协商并在 claim 之前/之后都保留 tombstone。
              retirePendingGuestMembership(runtime, pendingMembership)
            }
          } else {
            leaveCollaborationCommentSession({
              sessionId: state.sessionId!,
              resumeId: state.resumeId!,
              protocolVersion: state.commentProtocolVersion ?? undefined,
              hostLeaseId: state.commentHostLeaseId ?? undefined,
            }).catch((error) => {
              console.warn('[collaboration] best-effort leave failed:', error)
            })
          }

          cleanupSession(runtime, set, get, { generation, remote: false })

          return
        }

        try {
          let result

          if (state.role === 'guest') {
            const commentAccess = state.commentAccess

            if (!commentAccess) {
              const pendingMembership = getCurrentPendingGuestMembership(
                runtime,
                generation,
                state,
              )

              if (!pendingMembership) {
                throw new Error('协作者评论权限缺失，请重新加载邀请')
              }

              result = await releaseGuestMembership(pendingMembership, {
                bestEffort: false,
              })

              clearPendingGuestMembership(runtime, pendingMembership)
            } else if (
              commentAccess.protocolVersion === 2 &&
              !commentAccess.memberLeaseId
            ) {
              throw new Error('协作者成员租约缺失，请重新加载邀请')
            } else {
              result = await releaseGuestMembership(
                {
                  sessionId: state.sessionId!,
                  resumeId: state.resumeId!,
                  protocolVersion: commentAccess.protocolVersion,
                  memberLeaseId: commentAccess.memberLeaseId ?? undefined,
                },
                { bestEffort: false },
              )
            }
          } else {
            if (!state.commentProtocolVersion) {
              throw new Error('协作协议版本缺失，请重新开启协作')
            }

            result = await leaveCollaborationCommentSession({
              sessionId: state.sessionId!,
              resumeId: state.resumeId!,
              protocolVersion: state.commentProtocolVersion,
              hostLeaseId: state.commentHostLeaseId ?? undefined,
            })
          }

          if (!isCurrentStop()) {
            return
          }

          if (result?.revoked !== true) {
            throw new Error('服务端未确认关闭协作，请重试')
          }
        } catch (error) {
          if (isCurrentStop()) {
            setPhase(set, 'connected', {
              error: getErrorMessage(error, '关闭协作失败'),
            })

            throw error
          }

          return
        }

        if (state.role === 'host' && docManager) {
          if (!isCurrentStop()) {
            return
          }

          try {
            await broadcastShareEnded(docManager)
          } catch (error) {
            console.warn(
              '[collaboration] share-ended broadcast was not acknowledged:',
              error,
            )
          }
        }

        if (!isCurrentStop()) {
          return
        }

        const cleaned = cleanupSession(runtime, set, get, {
          generation,
          remote: false,
        })

        if (cleaned && !silent) {
          toast.success(
            state.role === 'host' ? '已关闭实时协作' : '已退出实时协作',
          )
        }
      })()

      const operation = { generation, sessionId, promise: stopPromise }

      activeStopOperation = operation

      try {
        await stopPromise
      } finally {
        if (activeStopOperation === operation) {
          activeStopOperation = null
        }
      }
    },
  }
}
