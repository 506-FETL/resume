import useResumeStore from '@/store/resume/form'
import { toast } from 'sonner'
import { createSessionCallbacks } from '../callbacks'
import {
  CollaborationOperationError,
  connectDocumentSession,
  joinCollaborationCommentSession,
  renewCollaborationCommentSession,
} from '../service'
import { createConnectedSessionState } from '../state'
import { rememberSessionRole } from '../storage'
import type {
  CollaborationSessionSetState,
  CollaborationSessionStore,
  PreparedGuestSession,
} from '../types'
import { assertPreparedSession, getErrorMessage } from './guards'
import { startGuestLease } from './guest-lease'
import { cleanupSession, setPhase } from './lifecycle'
import {
  clearPendingGuestMembership,
  releaseGuestMembership,
  retirePendingGuestMembership,
} from './membership'
import { loadRichTextCollabStore, startRichTextSession } from './rich-text'
import type { PendingGuestMembership, SessionRuntime } from './types'

export function createGuestActions(
  runtime: SessionRuntime,
  set: CollaborationSessionSetState,
  get: () => CollaborationSessionStore,
): Pick<
  CollaborationSessionStore,
  | 'prepareGuestSession'
  | 'markGuestSessionHydrating'
  | 'connectPreparedGuestSession'
  | 'abortPreparedGuestSession'
  | 'joinSession'
  | 'refreshCommentAccess'
> {
  return {
    prepareGuestSession: async (params) => {
      if (runtime.pendingGuestMembership) {
        retirePendingGuestMembership(runtime, runtime.pendingGuestMembership)
      }

      const generation = ++runtime.generation
      const memberLeaseId = crypto.randomUUID()

      const membership: PendingGuestMembership = {
        generation,
        sessionId: params.sessionId,
        resumeId: params.resumeId,
        memberLeaseId,
      }

      let joinAttempted = false

      runtime.stopLeaseMonitor?.()
      runtime.stopLeaseMonitor = null
      // join 发出前先暴露 generation-bound token，使 authorizing 阶段卸载
      // 也能发送 release-before-claim tombstone。
      runtime.pendingGuestMembership = membership

      setPhase(set, 'authorizing', {
        role: 'guest',
        sessionId: params.sessionId,
        resumeId: params.resumeId,
        commentAccess: null,
        commentHostLeaseId: null,
        commentProtocolVersion: null,
        error: null,
        shareEndedByRemote: false,
      })

      try {
        joinAttempted = true

        const authorization = await joinCollaborationCommentSession({
          sessionId: params.sessionId,
          resumeId: params.resumeId,
          memberLeaseId,
        })

        if (generation !== runtime.generation) {
          throw new CollaborationOperationError('协作会话已切换', {
            code: 'session_changed',
          })
        }

        return { ...params, generation, memberLeaseId, authorization }
      } catch (error) {
        const ownerMustHost =
          error instanceof CollaborationOperationError &&
          error.code === 'owner_must_host'

        try {
          if (joinAttempted && !ownerMustHost) {
            // stop/unmount 可能已经用同 token 写入 tombstone；迟到 join
            // 再次 release 是幂等的，确保 claim 永远不会复活。
            await releaseGuestMembership(membership, { bestEffort: true })
          }
        } finally {
          clearPendingGuestMembership(runtime, membership)
        }

        if (generation === runtime.generation) {
          setPhase(set, 'error', {
            error: getErrorMessage(error, '协作邀请鉴权失败'),
          })
        }

        throw error
      }
    },
    markGuestSessionHydrating: (prepared) => {
      assertPreparedSession(prepared, runtime.generation, get)

      setPhase(set, 'hydrating', {
        commentAccess: prepared.authorization.commentAccess,
        error: null,
      })

      // commentAccess 已原子接管同一 token；pending 只在 authorizing 窗口存在。
      clearPendingGuestMembership(runtime, prepared)
    },
    connectPreparedGuestSession: async (prepared) => {
      assertPreparedSession(prepared, runtime.generation, get)

      const docManager = useResumeStore.getState().docManager

      if (!docManager?.getHandle() || docManager.canPersist()) {
        throw new CollaborationOperationError(
          '共享简历尚未通过鉴权快照完成加载',
          {
            code: 'collaboration_document_not_hydrated',
          },
        )
      }

      setPhase(set, 'connecting', {
        commentAccess: prepared.authorization.commentAccess,
        error: null,
      })

      const loadedRichTextStore = await loadRichTextCollabStore()

      assertPreparedSession(prepared, runtime.generation, get)
      runtime.richTextStore = loadedRichTextStore

      const result = await connectDocumentSession({
        ...prepared,
        role: 'guest',
        getState: get,
        setState: set as CollaborationSessionSetState,
        createCallbacks: createSessionCallbacks,
        getDocumentManager: () => useResumeStore.getState().docManager,
        isCurrentSession: () => {
          const state = get()

          return (
            runtime.generation === prepared.generation &&
            state.sessionId === prepared.sessionId &&
            state.resumeId === prepared.resumeId &&
            state.role === 'guest'
          )
        },
      })

      try {
        assertPreparedSession(prepared, runtime.generation, get)
      } catch (error) {
        docManager.disableCollaboration(result.activationId)

        throw error
      }

      set(
        createConnectedSessionState(result, {
          commentAccess: prepared.authorization.commentAccess,
          commentHostLeaseId: null,
          commentProtocolVersion:
            prepared.authorization.commentAccess.protocolVersion,
        }),
      )

      clearPendingGuestMembership(runtime, prepared)

      rememberSessionRole({
        sessionId: result.sessionId,
        resumeId: result.resumeId,
        userId: result.self.userId,
        role: 'guest',
      })

      startRichTextSession(runtime, result, false)
      startGuestLease(runtime, set, get, prepared)
    },
    abortPreparedGuestSession: async (prepared) => {
      const isCurrent = prepared.generation === runtime.generation

      clearPendingGuestMembership(runtime, prepared)

      if (isCurrent) {
        cleanupSession(runtime, set, get, {
          generation: prepared.generation,
          remote: false,
          error: '共享简历加载或连接失败',
        })
      }

      await releaseGuestMembership(
        {
          sessionId: prepared.sessionId,
          resumeId: prepared.resumeId,
          protocolVersion: prepared.authorization.commentAccess.protocolVersion,
          memberLeaseId:
            prepared.authorization.commentAccess.memberLeaseId ?? undefined,
        },
        { bestEffort: true },
      )
    },
    // 邀请加载器迁移前保留的兼容入口。它仍严格要求当前 DocumentManager 已是
    // collaboration source，因此不会把 owner 文档误当作 guest 文档连接。
    joinSession: async (params) => {
      let prepared: PreparedGuestSession | null = null

      try {
        prepared = await get().prepareGuestSession(params)
        get().markGuestSessionHydrating(prepared)
        await get().connectPreparedGuestSession(prepared)
        toast.info('已加入实时协作', { description: '正在与发起者同步内容' })
      } catch (error) {
        if (prepared) {
          await get().abortPreparedGuestSession(prepared)
        }

        throw error
      }
    },
    refreshCommentAccess: async () => {
      const state = get()
      const generation = runtime.generation

      if (state.role !== 'guest' || !state.sessionId || !state.resumeId) {
        throw new Error('当前不处于协作者评论会话')
      }
      if (!state.commentAccess) {
        throw new Error('协作者评论权限缺失，请重新加载邀请')
      }
      if (
        state.commentAccess.protocolVersion === 2 &&
        !state.commentAccess.memberLeaseId
      ) {
        throw new Error('协作者成员租约缺失，请重新加载邀请')
      }

      const commentAccess = await renewCollaborationCommentSession({
        sessionId: state.sessionId,
        resumeId: state.resumeId,
        protocolVersion: state.commentAccess.protocolVersion,
        memberLeaseId: state.commentAccess.memberLeaseId ?? undefined,
      })

      if (
        generation !== runtime.generation ||
        get().sessionId !== state.sessionId ||
        get().role !== 'guest'
      ) {
        throw new Error('协作会话已切换')
      }

      set({ commentAccess })

      return commentAccess
    },
  }
}
