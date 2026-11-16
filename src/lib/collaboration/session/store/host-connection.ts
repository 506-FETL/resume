import useResumeStore from '@/store/resume/form'
import { createSessionCallbacks } from '../callbacks'
import {
  CollaborationOperationError,
  connectDocumentSession,
  leaveCollaborationCommentSession,
  registerCollaborationCommentSession,
} from '../service'
import { createConnectedSessionState } from '../state'
import { rememberSessionRole } from '../storage'
import type {
  CollaborationProtocolVersion,
  CollaborationSessionSetState,
  CollaborationSessionStore,
  JoinShareParams,
} from '../types'
import { getErrorMessage, isSamePendingHostAttempt } from './guards'
import { cleanupSession, setPhase } from './lifecycle'
import { retirePendingGuestMembership } from './membership'
import { loadRichTextCollabStore, startRichTextSession } from './rich-text'
import type {
  HostStartRuntime,
  PendingHostAttemptIdentity,
  SessionRuntime,
} from './types'

export function createHostConnector(
  runtime: SessionRuntime,
  host: HostStartRuntime,
  set: CollaborationSessionSetState,
  get: () => CollaborationSessionStore,
) {
  const connectHostSession = async (
    params: JoinShareParams,
    options: {
      saveSnapshot: boolean
      seedRichText: boolean
      pendingAttempt?: PendingHostAttemptIdentity
    },
  ) => {
    if (runtime.pendingGuestMembership) {
      retirePendingGuestMembership(runtime, runtime.pendingGuestMembership)
    }

    const generation = ++runtime.generation
    let hostLeaseId: string | null = null
    let hostProtocolVersion: CollaborationProtocolVersion | null = null
    const docManager = useResumeStore.getState().docManager

    if (options.pendingAttempt) {
      if (
        !isSamePendingHostAttempt(host.pendingAttempt, options.pendingAttempt)
      ) {
        throw new CollaborationOperationError('协作会话已切换', {
          code: 'session_changed',
        })
      }

      host.pendingAttempt = {
        ...options.pendingAttempt,
        ownerGeneration: generation,
        status: 'active',
      }
    }

    const ownsPendingAttempt = () =>
      !options.pendingAttempt ||
      (isSamePendingHostAttempt(host.pendingAttempt, options.pendingAttempt) &&
        host.pendingAttempt?.ownerGeneration === generation)

    const isCurrentHostOperation = () =>
      generation === runtime.generation && ownsPendingAttempt()

    setPhase(set, options.saveSnapshot ? 'syncing' : 'authorizing', {
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

      const loadedRichTextStore = await loadRichTextCollabStore()

      if (!isCurrentHostOperation()) {
        throw new CollaborationOperationError('协作会话已切换', {
          code: 'session_changed',
        })
      }

      runtime.richTextStore = loadedRichTextStore

      if (options.saveSnapshot) {
        await useResumeStore.getState().syncToSupabase()

        if (generation !== runtime.generation) {
          throw new CollaborationOperationError('协作会话已切换', {
            code: 'session_changed',
          })
        }

        const resumeState = useResumeStore.getState()

        if (
          resumeState.docManager !== docManager ||
          resumeState.currentResumeId !== params.resumeId
        ) {
          throw new CollaborationOperationError('协作简历已切换', {
            code: 'session_changed',
          })
        }
        if (resumeState.syncError) {
          throw new Error(`共享前保存简历失败：${resumeState.syncError}`)
        }

        setPhase(set, 'authorizing')
      }

      const registration = await registerCollaborationCommentSession({
        sessionId: params.sessionId,
        resumeId: params.resumeId,
      })

      hostLeaseId = registration.hostLeaseId
      hostProtocolVersion = registration.protocolVersion

      if (generation !== runtime.generation) {
        throw new CollaborationOperationError('协作会话已切换', {
          code: 'session_changed',
        })
      }

      setPhase(set, 'connecting', {
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

          return (
            runtime.generation === generation &&
            state.sessionId === params.sessionId &&
            state.resumeId === params.resumeId &&
            state.role === 'host'
          )
        },
      })

      if (generation !== runtime.generation) {
        docManager.disableCollaboration(result.activationId)

        throw new CollaborationOperationError('协作会话已切换', {
          code: 'session_changed',
        })
      }

      set(
        createConnectedSessionState(result, {
          commentAccess: null,
          commentHostLeaseId: hostLeaseId,
          commentProtocolVersion: hostProtocolVersion,
        }),
      )

      rememberSessionRole({
        sessionId: result.sessionId,
        resumeId: result.resumeId,
        userId: result.self.userId,
        role: 'host',
      })

      startRichTextSession(runtime, result, options.seedRichText)

      if (options.pendingAttempt && ownsPendingAttempt()) {
        host.pendingAttempt = null
      }
    } catch (error) {
      let rollbackRevoked = false

      if (hostLeaseId && hostProtocolVersion && isCurrentHostOperation()) {
        if (options.pendingAttempt && ownsPendingAttempt()) {
          host.pendingAttempt = {
            ...host.pendingAttempt!,
            status: 'rolling_back',
          }
        }

        try {
          const rollback = await leaveCollaborationCommentSession({
            sessionId: params.sessionId,
            resumeId: params.resumeId,
            protocolVersion: hostProtocolVersion,
            hostLeaseId,
          })

          rollbackRevoked = rollback.revoked === true
        } catch (revokeError) {
          console.warn(
            '[collaboration] failed to revoke incomplete host session:',
            revokeError,
          )
        }
      }

      const sessionRetired =
        error instanceof CollaborationOperationError &&
        error.code === 'session_id_retired'

      if (options.pendingAttempt && ownsPendingAttempt()) {
        if (rollbackRevoked || sessionRetired) {
          host.pendingAttempt = null
        } else {
          host.pendingAttempt = {
            ...host.pendingAttempt!,
            status: 'retryable',
          }
        }
      }

      if (generation === runtime.generation) {
        cleanupSession(runtime, set, get, {
          generation,
          remote: false,
          error: getErrorMessage(error, '建立协作会话失败'),
        })
      }

      throw error
    }
  }

  return connectHostSession
}
