import type {
  CollaborationConnectionPhase,
  CollaborationSessionSetState,
  CollaborationSessionStore,
  JoinShareParams,
  StartShareParams,
} from './types'
import { toast } from 'sonner'
import { create } from 'zustand'
import useResumeStore from '@/store/resume/form'
import { useRichTextCollabStore } from '../richtext'
import { createCollaborationSessionId } from '../shared'
import { createSessionCallbacks } from './callbacks'
import {
  CollaborationOperationError,
  enableCollaborationSession,
  joinCollaborationCommentSession,
  leaveCollaborationCommentSession,
  registerCollaborationCommentSession,
  renewCollaborationCommentSession,
} from './service'
import {
  createConnectedSessionState,
  createInitialCollaborationSessionState,
  createStoppedSessionState,
} from './state'
import { clearStoredSession, rememberSessionRole } from './storage'

function setConnectionPhase(
  set: CollaborationSessionSetState,
  phase: Exclude<CollaborationConnectionPhase, null>,
) {
  set({ isConnecting: true, connectionPhase: phase, error: null })
}

async function activateSession(
  params:
    | (StartShareParams & { sessionId: string, role: 'host', shouldSaveSnapshot: boolean })
    | (JoinShareParams & { role: 'guest' | 'host', shouldSaveSnapshot: boolean }),
  access: {
    get: () => CollaborationSessionStore
    set: CollaborationSessionSetState
  },
) {
  const { get, set } = access

  setConnectionPhase(set, params.role === 'guest' ? 'connecting' : 'registering')

  const commentAuthorization = params.role === 'guest'
    ? await joinCollaborationCommentSession({
        sessionId: params.sessionId,
        resumeId: params.resumeId,
      }).then(commentAccess => ({
        commentAccess,
        commentHostLeaseId: null,
      }))
    : await registerCollaborationCommentSession({
        sessionId: params.sessionId,
        resumeId: params.resumeId,
      }).then(registration => ({
        commentAccess: null,
        commentHostLeaseId: registration.hostLeaseId,
      }))

  setConnectionPhase(set, 'connecting')
  const result = await enableCollaborationSession({
    ...params,
    getState: get,
    setState: set,
    createCallbacks: createSessionCallbacks,
    getDocumentManager: () => useResumeStore.getState().docManager,
    onPhaseChange: phase => setConnectionPhase(set, phase),
  })
    .catch((error) => {
      leaveCollaborationCommentSession({
        sessionId: params.sessionId,
        resumeId: params.resumeId,
        hostLeaseId: commentAuthorization.commentHostLeaseId ?? undefined,
      }).catch(() => undefined)
      throw error
    })

  set(createConnectedSessionState(result, commentAuthorization))
  rememberSessionRole({
    sessionId: result.sessionId,
    resumeId: result.resumeId,
    userId: result.self.userId,
    role: result.role,
  })

  // 启动富文本 Yjs 协作层（字符级合并 + 编辑器内远端光标）。
  // 仅全新 host 分享（shouldSaveSnapshot=true）才种子化现有 HTML；
  // 加入会话与 resumeHosting 重连不种子化，避免与已有 Yjs 状态叠加导致内容重复。
  useRichTextCollabStore.getState().start({
    resumeId: result.resumeId,
    sessionId: result.sessionId,
    role: result.role,
    userName: result.self.userName,
    color: result.self.color,
    userId: result.self.userId,
    seed: params.shouldSaveSnapshot === true,
  })
}

const useCollaborationStore = create<CollaborationSessionStore>()((set, get) => ({
  ...createInitialCollaborationSessionState(),

  startSharing: async ({ resumeId, userId, userName }) => {
    if (get().isConnecting)
      return

    const existingSession = get().sessionId

    if (existingSession) {
      get().stopSharing({ silent: true })
    }

    try {
      await activateSession(
        {
          sessionId: createCollaborationSessionId(),
          resumeId,
          userId,
          userName,
          role: 'host',
          shouldSaveSnapshot: true,
        },
        { get, set },
      )

      toast.success('已开启实时协作', { description: '现在可以将链接分享给他人了' })
    }
    catch (error) {
      const message = error instanceof Error ? error.message : '开启协作失败'
      set({ isConnecting: false, connectionPhase: null, error: message })
      toast.error(message)
      throw error
    }
  },

  joinSession: async ({ sessionId, resumeId, userId, userName }) => {
    if (get().isConnecting)
      return

    if (get().sessionId === sessionId && get().isSharing) {
      return
    }

    try {
      await activateSession(
        {
          sessionId,
          resumeId,
          userId,
          userName,
          role: 'guest',
          shouldSaveSnapshot: false,
        },
        { get, set },
      )

      toast.info('已加入实时协作', { description: '正在与发起者同步内容' })
    }
    catch (error) {
      // 简历所有者点开自己的协作链接（换设备/清缓存导致本地无 host 角色记录）时，
      // 后端返回 unauthorized；此时他本就是所有者，无缝转为以主持人身份恢复协作，避免误报错误。
      if (error instanceof CollaborationOperationError && error.code === 'unauthorized') {
        set({ isConnecting: false, connectionPhase: null, error: null })
        await get().resumeHosting({ sessionId, resumeId, userId, userName })
        return
      }
      const message = error instanceof Error ? error.message : '加入协作失败'
      set({ isConnecting: false, connectionPhase: null, error: message })
      toast.error(message)
      throw error
    }
  },

  resumeHosting: async ({ sessionId, resumeId, userId, userName }) => {
    if (get().isConnecting)
      return

    try {
      await activateSession(
        {
          sessionId,
          resumeId,
          userId,
          userName,
          role: 'host',
          shouldSaveSnapshot: false,
        },
        { get, set },
      )

      toast.success('已恢复实时协作', { description: '协作者可以继续编辑' })
    }
    catch (error) {
      const message = error instanceof Error ? error.message : '恢复协作失败'
      set({ isConnecting: false, connectionPhase: null, error: message })
      toast.error(message)
      throw error
    }
  },

  stopSharing: ({ silent } = {}) => {
    const state = get()

    if (!state.isSharing && !state.sessionId) {
      return
    }

    const docManager = useResumeStore.getState().docManager

    if (state.sessionId && state.resumeId) {
      leaveCollaborationCommentSession({
        sessionId: state.sessionId,
        resumeId: state.resumeId,
        hostLeaseId: state.commentHostLeaseId ?? undefined,
      }).catch(() => undefined)
    }

    if (state.role === 'host' && state.sessionId && docManager) {
      docManager.broadcastCollaborationEvent('share-ended', { reason: 'host_closed' })
    }

    try {
      docManager?.disableCollaboration()
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(`关闭协作时出错，请重试: ${message}`)
    }

    // 销毁富文本 Yjs 层（provider/doc/awareness，含去抖 flush 由编辑器卸载处理）
    useRichTextCollabStore.getState().stop()

    if (state.sessionId && state.resumeId && state.self) {
      clearStoredSession(state.sessionId, state.resumeId, state.self.userId)
    }

    set(createStoppedSessionState())

    if (!silent) {
      toast.success(state.role === 'host' ? '已关闭实时协作' : '已退出实时协作')
    }
  },

  refreshCommentAccess: async () => {
    const state = get()
    if (state.role !== 'guest' || !state.sessionId || !state.resumeId) {
      throw new Error('当前不处于协作者评论会话')
    }
    const commentAccess = await renewCollaborationCommentSession({
      sessionId: state.sessionId,
      resumeId: state.resumeId,
    })
    if (get().sessionId !== state.sessionId || get().role !== 'guest') {
      throw new Error('协作会话已切换')
    }
    set({ commentAccess })
    return commentAccess
  },

  handleRemoteShareEnd: () => {
    const state = get()

    if (!state.role) {
      return
    }

    useResumeStore.getState().docManager?.disableCollaboration()
    useRichTextCollabStore.getState().stop()

    if (state.sessionId && state.resumeId) {
      leaveCollaborationCommentSession({
        sessionId: state.sessionId,
        resumeId: state.resumeId,
      }).catch(() => undefined)
    }

    if (state.sessionId && state.resumeId && state.self) {
      clearStoredSession(state.sessionId, state.resumeId, state.self.userId)
    }

    set(
      createStoppedSessionState({
        shareEndedByRemote: true,
      }),
    )

    toast.warning('协作已结束', { description: '发起者已关闭实时协作' })
  },

  acknowledgeRemoteShareEnd: () => {
    if (get().shareEndedByRemote) {
      set({ shareEndedByRemote: false })
    }
  },
}))

export default useCollaborationStore
