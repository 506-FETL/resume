import type {
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
import { enableCollaborationSession } from './service'
import {
  createConnectedSessionState,
  createInitialCollaborationSessionState,
  createStoppedSessionState,
} from './state'
import { clearStoredSession, rememberSessionRole } from './storage'

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

  const result = await enableCollaborationSession({
    ...params,
    getState: get,
    setState: set,
    createCallbacks: createSessionCallbacks,
    getDocumentManager: () => useResumeStore.getState().docManager,
  })

  set(createConnectedSessionState(result))
  rememberSessionRole({
    sessionId: result.sessionId,
    resumeId: result.resumeId,
    userId: result.userId,
    role: result.role,
  })

  // 启动富文本 Yjs 协作层（字符级合并 + 编辑器内远端光标）
  useRichTextCollabStore.getState().start({
    resumeId: result.resumeId,
    sessionId: result.sessionId,
    role: result.role,
    userName: result.userName,
    color: result.color,
  })
}

const useCollaborationStore = create<CollaborationSessionStore>()((set, get) => ({
  ...createInitialCollaborationSessionState(),

  startSharing: async ({ resumeId, userId, userName }) => {
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
      set({ isConnecting: false, error: message })
      toast.error(message)
      throw error
    }
  },

  joinSession: async ({ sessionId, resumeId, userId, userName }) => {
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
      const message = error instanceof Error ? error.message : '加入协作失败'
      set({ isConnecting: false, error: message })
      toast.error(message)
      throw error
    }
  },

  resumeHosting: async ({ sessionId, resumeId, userId, userName }) => {
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
      set({ isConnecting: false, error: message })
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

    if (state.sessionId && state.resumeId && state.selfUserId) {
      clearStoredSession(state.sessionId, state.resumeId, state.selfUserId)
    }

    set(createStoppedSessionState(state))

    if (!silent) {
      toast.success(state.role === 'host' ? '已关闭实时协作' : '已退出实时协作')
    }
  },

  handleRemoteShareEnd: () => {
    const state = get()

    if (!state.role) {
      return
    }

    useResumeStore.getState().docManager?.disableCollaboration()
    useRichTextCollabStore.getState().stop()

    if (state.sessionId && state.resumeId && state.selfUserId) {
      clearStoredSession(state.sessionId, state.resumeId, state.selfUserId)
    }

    set(
      createStoppedSessionState(state, {
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
