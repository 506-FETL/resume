import type { CollaborationRole } from '../shared'
import type { CollaborationCallbacks } from '@/lib/automerge'

export interface CollaborationIdentity {
  userId: string
  userName: string
  color: string
}

export interface CollaborationSelf extends CollaborationIdentity {
  peerId: string | null
}

export interface CollaborationCommentAccess {
  accessToken: string
  memberLeaseId: string
  expiresAt: string
  sessionId: string
  resumeId: string
  versionId: number
  userId: string
  role: 'editor' | 'viewer'
}

export interface CollaborationDocumentBootstrap {
  documentData: string
  updatedAt: string
  documentVersion: number
  heads: string[]
}

export interface CollaborationGuestAuthorization {
  commentAccess: CollaborationCommentAccess
  bootstrap: CollaborationDocumentBootstrap
}

export interface CollaborationParticipantMetadata extends CollaborationIdentity {
  role: CollaborationRole | null
}

export interface CollaborationParticipant {
  peerId: string
  metadata: CollaborationParticipantMetadata
}

export interface StartShareParams {
  resumeId: string
  userId: string
  userName: string
}

export interface JoinShareParams extends StartShareParams {
  sessionId: string
}

export type CollaborationPhase
  = | 'idle'
    | 'authenticating'
    | 'authorizing'
    | 'hydrating'
    | 'connecting'
    | 'syncing'
    | 'connected'
    | 'stopping'
    | 'ended'
    | 'error'

export interface PreparedGuestSession extends JoinShareParams {
  generation: number
  memberLeaseId: string
  authorization: CollaborationGuestAuthorization
}

export interface CollaborationSessionState {
  isSharing: boolean
  isConnecting: boolean
  phase: CollaborationPhase
  role: CollaborationRole | null
  sessionId: string | null
  shareUrl: string | null
  resumeId: string | null
  roomName: string | null
  participants: Record<string, CollaborationParticipant>
  error: string | null
  self: CollaborationSelf | null
  commentAccess: CollaborationCommentAccess | null
  commentHostLeaseId: string | null
  shareEndedByRemote: boolean
}

export interface CollaborationSessionActions {
  startSharing: (params: StartShareParams) => Promise<void>
  /** @deprecated 邀请加载器迁移期间的兼容入口；新流程应分阶段调用 prepare/hydrate/connect。 */
  joinSession: (params: JoinShareParams) => Promise<void>
  markInviteAuthenticating: () => void
  prepareGuestSession: (params: JoinShareParams) => Promise<PreparedGuestSession>
  markGuestSessionHydrating: (prepared: PreparedGuestSession) => void
  connectPreparedGuestSession: (prepared: PreparedGuestSession) => Promise<void>
  abortPreparedGuestSession: (prepared: PreparedGuestSession) => Promise<void>
  resumeHosting: (params: JoinShareParams) => Promise<void>
  stopSharing: (options?: { silent?: boolean, bestEffort?: boolean }) => Promise<void>
  refreshCommentAccess: () => Promise<CollaborationCommentAccess>
  handleRemoteShareEnd: () => void
  acknowledgeRemoteShareEnd: () => void
}

export type CollaborationSessionStore = CollaborationSessionState & CollaborationSessionActions

export type CollaborationSessionSetState = (
  state:
    | Partial<CollaborationSessionState>
    | ((state: CollaborationSessionStore) => Partial<CollaborationSessionState>),
) => void

export interface CollaborationSessionStoreAccess {
  getState: () => CollaborationSessionStore
  setState: CollaborationSessionSetState
}

export interface SessionCallbacksOptions extends CollaborationSessionStoreAccess {
  role: CollaborationRole
  identity: CollaborationIdentity
  adapterPeerIdRef: { current: string | null }
}

export interface SessionActivationOptions extends CollaborationSessionStoreAccess {
  sessionId: string
  resumeId: string
  userId: string
  userName: string
  role: CollaborationRole
}

export interface CollaborationActivationResult {
  sessionId: string
  resumeId: string
  role: CollaborationRole
  self: CollaborationSelf
  shareUrl: string
  roomName: string
}

export type CreateSessionCallbacks = (options: SessionCallbacksOptions) => CollaborationCallbacks
