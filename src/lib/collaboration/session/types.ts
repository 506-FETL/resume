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

export type CollaborationConnectionPhase
  = | 'registering'
    | 'connecting'
    | 'syncing'
    | null

export interface CollaborationSessionState {
  isSharing: boolean
  isConnecting: boolean
  connectionPhase: CollaborationConnectionPhase
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
  joinSession: (params: JoinShareParams) => Promise<void>
  resumeHosting: (params: JoinShareParams) => Promise<void>
  stopSharing: (options?: { silent?: boolean }) => void
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
  shouldSaveSnapshot?: boolean
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
