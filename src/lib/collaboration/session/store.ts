import type {
  CollaborationProtocolVersion,
  CollaborationSessionSetState,
  CollaborationSessionStore,
  JoinShareParams,
  PreparedGuestSession,
  StartShareParams,
} from './types'
import type { DocumentManager } from '@/lib/automerge'
import { toast } from 'sonner'
import { create } from 'zustand'
import { COLLABORATION_CONTROL_ACK_TIMEOUT_MS } from '@/lib/automerge'
import useResumeStore from '@/store/resume/form'
import { useRichTextCollabStore } from '../richtext'
import { createCollaborationSessionId } from '../shared'
import { createSessionCallbacks } from './callbacks'
import { startCollaborationLeaseMonitor } from './lease'
import {
  CollaborationOperationError,
  connectDocumentSession,
  joinCollaborationCommentSession,
  leaveCollaborationCommentSession,
  registerCollaborationCommentSession,
  renewCollaborationCommentSession,
} from './service'
import {
  createCollaborationPhaseState,
  createConnectedSessionState,
  createInitialCollaborationSessionState,
  createStoppedSessionState,
} from './state'
import { clearStoredSession, rememberSessionRole } from './storage'

interface CleanupSessionOptions {
  generation: number
  remote: boolean
  error?: string
}

interface ActiveStopOperation {
  generation: number
  sessionId: string
  promise: Promise<void>
}

interface GuestMembershipIdentity {
  sessionId: string
  resumeId: string
  protocolVersion?: CollaborationProtocolVersion
  memberLeaseId?: string
}

interface PendingHostAttempt {
  sessionId: string
  resumeId: string
  userId: string
  ownerGeneration: number
}

type PendingHostAttemptIdentity = Omit<PendingHostAttempt, 'ownerGeneration'>

function isSamePendingHostAttempt(
  attempt: PendingHostAttempt | null,
  identity: PendingHostAttemptIdentity,
) {
  return attempt?.sessionId === identity.sessionId
    && attempt.resumeId === identity.resumeId
    && attempt.userId === identity.userId
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function assertPreparedSession(
  prepared: PreparedGuestSession,
  generation: number,
  get: () => CollaborationSessionStore,
) {
  const state = get()
  if (
    prepared.generation !== generation
    || state.sessionId !== prepared.sessionId
    || state.resumeId !== prepared.resumeId
    || state.role !== 'guest'
  ) {
    throw new CollaborationOperationError('协作会话已切换', { code: 'session_changed' })
  }
}

async function broadcastShareEnded(docManager: DocumentManager) {
  let timeout: ReturnType<typeof setTimeout> | null = null

  try {
    await Promise.race([
      docManager.broadcastCollaborationEvent('share-ended', { reason: 'host_closed' }),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error('协作结束通知确认超时')),
          COLLABORATION_CONTROL_ACK_TIMEOUT_MS,
        )
      }),
    ])
  }
  finally {
    if (timeout) {
      clearTimeout(timeout)
    }
  }
}

const useCollaborationStore = create<CollaborationSessionStore>()((set, get) => {
  let activeGeneration = 0
  let stopLeaseMonitor: (() => void) | null = null
  let activeStopOperation: ActiveStopOperation | null = null
  let pendingHostAttempt: PendingHostAttempt | null = null

  const setPhase = (
    phase: Parameters<typeof createCollaborationPhaseState>[0],
    overrides: Parameters<typeof createCollaborationPhaseState>[1] = {},
  ) => {
    set(createCollaborationPhaseState(phase, overrides))
  }

  const cleanupSession = ({ generation, remote, error }: CleanupSessionOptions) => {
    if (generation !== activeGeneration) {
      return false
    }

    const state = get()
    activeGeneration += 1
    stopLeaseMonitor?.()
    stopLeaseMonitor = null

    const docManager = useResumeStore.getState().docManager
    if (
      docManager
      && (!state.sessionId || docManager.getCollaborationSessionId() === state.sessionId)
    ) {
      try {
        docManager.disableCollaboration()
      }
      catch (cleanupError) {
        console.warn('[collaboration] Automerge cleanup failed:', cleanupError)
      }
    }

    useRichTextCollabStore.getState().stop()

    if (state.sessionId && state.resumeId && state.self) {
      clearStoredSession(state.sessionId, state.resumeId, state.self.userId)
    }

    set(createStoppedSessionState({
      phase: remote ? 'ended' : error ? 'error' : 'idle',
      error: error ?? null,
      shareEndedByRemote: remote,
    }))

    if (remote) {
      toast.warning('协作已结束', { description: '发起者已关闭实时协作' })
    }

    return true
  }

  const releaseGuestMembership = async (
    membership: GuestMembershipIdentity,
    options: { bestEffort: boolean },
  ) => {
    try {
      return await leaveCollaborationCommentSession({
        sessionId: membership.sessionId,
        resumeId: membership.resumeId,
        protocolVersion: membership.protocolVersion,
        memberLeaseId: membership.memberLeaseId,
      })
    }
    catch (error) {
      if (!options.bestEffort) {
        throw error
      }
      console.warn('[collaboration] failed to release guest membership:', error)
      return null
    }
  }

  const startRichTextSession = (
    result: Awaited<ReturnType<typeof connectDocumentSession>>,
    seed: boolean,
  ) => {
    useRichTextCollabStore.getState().start({
      resumeId: result.resumeId,
      sessionId: result.sessionId,
      role: result.role,
      userName: result.self.userName,
      color: result.self.color,
      userId: result.self.userId,
      seed,
    })
  }

  const connectHostSession = async (
    params: JoinShareParams,
    options: {
      saveSnapshot: boolean
      seedRichText: boolean
      pendingAttempt?: PendingHostAttemptIdentity
    },
  ) => {
    const generation = ++activeGeneration
    let hostLeaseId: string | null = null
    let hostProtocolVersion: CollaborationProtocolVersion | null = null
    const docManager = useResumeStore.getState().docManager

    if (options.pendingAttempt) {
      if (!isSamePendingHostAttempt(pendingHostAttempt, options.pendingAttempt)) {
        throw new CollaborationOperationError('协作会话已切换', { code: 'session_changed' })
      }
      pendingHostAttempt = {
        ...options.pendingAttempt,
        ownerGeneration: generation,
      }
    }

    const ownsPendingAttempt = () => generation === activeGeneration && (
      !options.pendingAttempt
      || (
        isSamePendingHostAttempt(pendingHostAttempt, options.pendingAttempt)
        && pendingHostAttempt?.ownerGeneration === generation
      )
    )

    setPhase(options.saveSnapshot ? 'syncing' : 'authorizing', {
      role: 'host',
      sessionId: params.sessionId,
      resumeId: params.resumeId,
      commentProtocolVersion: null,
      error: null,
      shareEndedByRemote: false,
    })

    try {
      if (!docManager?.getHandle()) {
        throw new Error('文档尚未初始化，无法开启协作')
      }
      if (!docManager.canPersist()) {
        throw new Error('共享文档不能恢复为协作发起者')
      }

      if (options.saveSnapshot) {
        await docManager.saveToSupabase()
        if (generation !== activeGeneration) {
          throw new CollaborationOperationError('协作会话已切换', { code: 'session_changed' })
        }
        setPhase('authorizing')
      }

      const registration = await registerCollaborationCommentSession({
        sessionId: params.sessionId,
        resumeId: params.resumeId,
      })
      hostLeaseId = registration.hostLeaseId
      hostProtocolVersion = registration.protocolVersion

      if (generation !== activeGeneration) {
        throw new CollaborationOperationError('协作会话已切换', { code: 'session_changed' })
      }

      setPhase('connecting', {
        commentHostLeaseId: hostLeaseId,
        commentProtocolVersion: hostProtocolVersion,
      })
      const result = await connectDocumentSession({
        ...params,
        role: 'host',
        getState: get,
        setState: set as CollaborationSessionSetState,
        createCallbacks: createSessionCallbacks,
        getDocumentManager: () => useResumeStore.getState().docManager,
        isCurrentSession: () => {
          const state = get()
          return activeGeneration === generation
            && state.sessionId === params.sessionId
            && state.resumeId === params.resumeId
            && state.role === 'host'
        },
      })

      if (generation !== activeGeneration) {
        if (docManager.getCollaborationSessionId() === params.sessionId) {
          docManager.disableCollaboration()
        }
        throw new CollaborationOperationError('协作会话已切换', { code: 'session_changed' })
      }

      set(createConnectedSessionState(result, {
        commentAccess: null,
        commentHostLeaseId: hostLeaseId,
        commentProtocolVersion: hostProtocolVersion,
      }))
      rememberSessionRole({
        sessionId: result.sessionId,
        resumeId: result.resumeId,
        userId: result.self.userId,
        role: 'host',
      })
      startRichTextSession(result, options.seedRichText)
      if (
        options.pendingAttempt
        && ownsPendingAttempt()
      ) {
        pendingHostAttempt = null
      }
    }
    catch (error) {
      let rollbackRevoked = false
      if (hostLeaseId && hostProtocolVersion && ownsPendingAttempt()) {
        try {
          const rollback = await leaveCollaborationCommentSession({
            sessionId: params.sessionId,
            resumeId: params.resumeId,
            protocolVersion: hostProtocolVersion,
            hostLeaseId,
          })
          if (ownsPendingAttempt()) {
            rollbackRevoked = rollback.revoked === true
          }
        }
        catch (revokeError) {
          if (ownsPendingAttempt()) {
            console.warn('[collaboration] failed to revoke incomplete host session:', revokeError)
          }
        }
      }

      const sessionRetired
        = error instanceof CollaborationOperationError && error.code === 'session_id_retired'
      if (
        (rollbackRevoked || sessionRetired)
        && options.pendingAttempt
        && ownsPendingAttempt()
      ) {
        pendingHostAttempt = null
      }

      if (generation === activeGeneration) {
        cleanupSession({
          generation,
          remote: false,
          error: getErrorMessage(error, '建立协作会话失败'),
        })
      }
      throw error
    }
  }

  const startGuestLease = (prepared: PreparedGuestSession) => {
    stopLeaseMonitor?.()
    stopLeaseMonitor = startCollaborationLeaseMonitor({
      renew: async () => {
        const commentAccess = await renewCollaborationCommentSession({
          sessionId: prepared.sessionId,
          resumeId: prepared.resumeId,
          protocolVersion: prepared.authorization.commentAccess.protocolVersion,
          memberLeaseId:
            prepared.authorization.commentAccess.memberLeaseId ?? undefined,
        })

        if (
          prepared.generation === activeGeneration
          && get().phase === 'connected'
          && get().role === 'guest'
        ) {
          set({ commentAccess })
        }
      },
      onRevoked: (error) => {
        console.warn('[collaboration] guest lease revoked:', error)
        cleanupSession({
          generation: prepared.generation,
          remote: true,
        })
      },
      onTransientError: (error) => {
        console.warn('[collaboration] guest lease renewal failed temporarily:', error)
      },
    })
  }

  return {
    ...createInitialCollaborationSessionState(),

    markInviteAuthenticating: () => {
      setPhase('authenticating', { error: null, shareEndedByRemote: false })
    },

    prepareGuestSession: async (params) => {
      const generation = ++activeGeneration
      const memberLeaseId = crypto.randomUUID()
      const membership = {
        sessionId: params.sessionId,
        resumeId: params.resumeId,
        memberLeaseId,
      }
      let joinAttempted = false
      stopLeaseMonitor?.()
      stopLeaseMonitor = null
      setPhase('authorizing', {
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
        if (generation !== activeGeneration) {
          throw new CollaborationOperationError('协作会话已切换', { code: 'session_changed' })
        }

        return { ...params, generation, memberLeaseId, authorization }
      }
      catch (error) {
        const ownerMustHost
          = error instanceof CollaborationOperationError && error.code === 'owner_must_host'
        if (joinAttempted && !ownerMustHost) {
          await releaseGuestMembership(membership, { bestEffort: true })
        }
        if (generation === activeGeneration) {
          setPhase('error', { error: getErrorMessage(error, '协作邀请鉴权失败') })
        }
        throw error
      }
    },

    markGuestSessionHydrating: (prepared) => {
      assertPreparedSession(prepared, activeGeneration, get)
      setPhase('hydrating', {
        commentAccess: prepared.authorization.commentAccess,
        error: null,
      })
    },

    connectPreparedGuestSession: async (prepared) => {
      assertPreparedSession(prepared, activeGeneration, get)
      const docManager = useResumeStore.getState().docManager
      if (!docManager?.getHandle() || docManager.canPersist()) {
        throw new CollaborationOperationError('共享简历尚未通过鉴权快照完成加载', {
          code: 'collaboration_document_not_hydrated',
        })
      }

      setPhase('connecting', {
        commentAccess: prepared.authorization.commentAccess,
        error: null,
      })

      const result = await connectDocumentSession({
        ...prepared,
        role: 'guest',
        getState: get,
        setState: set as CollaborationSessionSetState,
        createCallbacks: createSessionCallbacks,
        getDocumentManager: () => useResumeStore.getState().docManager,
        isCurrentSession: () => {
          const state = get()
          return activeGeneration === prepared.generation
            && state.sessionId === prepared.sessionId
            && state.resumeId === prepared.resumeId
            && state.role === 'guest'
        },
      })

      try {
        assertPreparedSession(prepared, activeGeneration, get)
      }
      catch (error) {
        if (docManager.getCollaborationSessionId() === prepared.sessionId) {
          docManager.disableCollaboration()
        }
        throw error
      }

      set(createConnectedSessionState(result, {
        commentAccess: prepared.authorization.commentAccess,
        commentHostLeaseId: null,
        commentProtocolVersion: prepared.authorization.commentAccess.protocolVersion,
      }))
      rememberSessionRole({
        sessionId: result.sessionId,
        resumeId: result.resumeId,
        userId: result.self.userId,
        role: 'guest',
      })
      startRichTextSession(result, false)
      startGuestLease(prepared)
    },

    abortPreparedGuestSession: async (prepared) => {
      const isCurrent = prepared.generation === activeGeneration

      if (isCurrent) {
        cleanupSession({
          generation: prepared.generation,
          remote: false,
          error: '共享简历加载或连接失败',
        })
      }
      await releaseGuestMembership({
        sessionId: prepared.sessionId,
        resumeId: prepared.resumeId,
        protocolVersion: prepared.authorization.commentAccess.protocolVersion,
        memberLeaseId:
          prepared.authorization.commentAccess.memberLeaseId ?? undefined,
      }, { bestEffort: true })
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
      }
      catch (error) {
        if (prepared) {
          await get().abortPreparedGuestSession(prepared)
        }
        throw error
      }
    },

    startSharing: async ({ resumeId, userId, userName }: StartShareParams) => {
      if (get().isConnecting) {
        return
      }

      if (get().sessionId || get().isSharing) {
        await get().stopSharing({ silent: true })
      }

      const attempt = pendingHostAttempt?.resumeId === resumeId
        && pendingHostAttempt.userId === userId
        ? pendingHostAttempt
        : {
            sessionId: createCollaborationSessionId(),
            resumeId,
            userId,
            ownerGeneration: activeGeneration,
          }
      pendingHostAttempt = attempt

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
        toast.success('已开启实时协作', { description: '现在可以将链接分享给他人了' })
      }
      catch (error) {
        toast.error(getErrorMessage(error, '开启协作失败'))
        throw error
      }
    },

    resumeHosting: async (params) => {
      if (get().isConnecting) {
        return
      }

      try {
        await connectHostSession(params, { saveSnapshot: false, seedRichText: false })
        toast.success('已恢复实时协作', { description: '协作者可以继续编辑' })
      }
      catch (error) {
        toast.error(getErrorMessage(error, '恢复协作失败'))
        throw error
      }
    },

    stopSharing: async ({ silent, bestEffort } = {}) => {
      const state = get()
      if (!state.role || !state.sessionId || !state.resumeId) {
        return
      }

      const generation = activeGeneration
      if (
        activeStopOperation?.generation === generation
        && activeStopOperation.sessionId === state.sessionId
      ) {
        return activeStopOperation.promise
      }

      const sessionId = state.sessionId
      const isCurrentStop = () => {
        const current = get()
        return activeGeneration === generation && current.sessionId === sessionId
      }
      const stopPromise = (async () => {
        const docManager = useResumeStore.getState().docManager
        setPhase('stopping', { error: null })

        if (bestEffort) {
          if (state.role === 'guest') {
            if (state.commentAccess) {
              releaseGuestMembership({
                sessionId: state.sessionId!,
                resumeId: state.resumeId!,
                protocolVersion: state.commentAccess.protocolVersion,
                memberLeaseId: state.commentAccess.memberLeaseId ?? undefined,
              }, { bestEffort: true }).catch(() => undefined)
            }
            else {
              console.warn('[collaboration] guest comment access is missing during best-effort stop')
            }
          }
          else {
            leaveCollaborationCommentSession({
              sessionId: state.sessionId!,
              resumeId: state.resumeId!,
              protocolVersion: state.commentProtocolVersion ?? undefined,
              hostLeaseId: state.commentHostLeaseId ?? undefined,
            }).catch((error) => {
              console.warn('[collaboration] best-effort leave failed:', error)
            })
          }
          cleanupSession({ generation, remote: false })
          return
        }

        try {
          let result
          if (state.role === 'guest') {
            const commentAccess = state.commentAccess
            if (!commentAccess) {
              throw new Error('协作者评论权限缺失，请重新加载邀请')
            }
            if (commentAccess.protocolVersion === 2 && !commentAccess.memberLeaseId) {
              throw new Error('协作者成员租约缺失，请重新加载邀请')
            }
            result = await releaseGuestMembership({
              sessionId: state.sessionId!,
              resumeId: state.resumeId!,
              protocolVersion: commentAccess.protocolVersion,
              memberLeaseId: commentAccess.memberLeaseId ?? undefined,
            }, { bestEffort: false })
          }
          else {
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
        }
        catch (error) {
          if (isCurrentStop()) {
            setPhase('connected', { error: getErrorMessage(error, '关闭协作失败') })
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
          }
          catch (error) {
            console.warn('[collaboration] share-ended broadcast was not acknowledged:', error)
          }
        }

        if (!isCurrentStop()) {
          return
        }

        const cleaned = cleanupSession({ generation, remote: false })

        if (cleaned && !silent) {
          toast.success(state.role === 'host' ? '已关闭实时协作' : '已退出实时协作')
        }
      })()

      const operation = { generation, sessionId, promise: stopPromise }
      activeStopOperation = operation
      try {
        await stopPromise
      }
      finally {
        if (activeStopOperation === operation) {
          activeStopOperation = null
        }
      }
    },

    refreshCommentAccess: async () => {
      const state = get()
      const generation = activeGeneration
      if (state.role !== 'guest' || !state.sessionId || !state.resumeId) {
        throw new Error('当前不处于协作者评论会话')
      }
      if (!state.commentAccess) {
        throw new Error('协作者评论权限缺失，请重新加载邀请')
      }
      if (state.commentAccess.protocolVersion === 2 && !state.commentAccess.memberLeaseId) {
        throw new Error('协作者成员租约缺失，请重新加载邀请')
      }

      const commentAccess = await renewCollaborationCommentSession({
        sessionId: state.sessionId,
        resumeId: state.resumeId,
        protocolVersion: state.commentAccess.protocolVersion,
        memberLeaseId: state.commentAccess.memberLeaseId ?? undefined,
      })
      if (
        generation !== activeGeneration
        || get().sessionId !== state.sessionId
        || get().role !== 'guest'
      ) {
        throw new Error('协作会话已切换')
      }
      set({ commentAccess })
      return commentAccess
    },

    handleRemoteShareEnd: () => {
      const state = get()
      if (state.role !== 'guest') {
        return
      }
      cleanupSession({ generation: activeGeneration, remote: true })
    },

    acknowledgeRemoteShareEnd: () => {
      if (get().shareEndedByRemote) {
        set({ shareEndedByRemote: false })
      }
    },
  }
})

export default useCollaborationStore
