import type { AccessKind, ActorKind } from './types.ts'

export interface BootstrapRpcInput {
  p_protocol_version: 1
  p_access_kind: AccessKind
  p_user_id: string | null
  p_scope_id: string | null
  p_resume_id: string | null
  p_version_id: number | null
  p_share_id: string | null
  p_release_id: string | null
  p_password_generation: string | null
  p_session_id: string | null
  p_collaborator_role: 'editor' | 'viewer' | null
  p_anonymous_id: string | null
  p_anonymous_secret_hash: string | null
}

export interface BootstrapInputContext {
  rpcInput: BootstrapRpcInput
  shareTokenSecret: string | null
  collaboratorLease: {
    protocolVersion: 1 | 2
    sessionId: string
    resumeId: string
    userId: string
    memberLeaseId: string | null
  } | null
}

export interface BootstrapAccessEnvelope {
  kind: AccessKind
  userId: string | null
  actorKind: ActorKind | null
  actorId: string | null
  actorKey: string | null
  legacyAnonymousId: string | null
  canWrite: boolean
  canManageAll: boolean
  scopeId: string
  versionId: number
  ownerUserId: string
  shareId: string | null
  releaseId: string | null
  sharePasswordHash: string | null
}

export interface BootstrapScope {
  id: string
  kind: 'version'
  owner_user_id: string
  resume_id: string
  version_id: number
  history_version_id: null
  share_release_id: null
  anchor_document: {
    nodes: Array<{ nodeKey: string }>
  }
  document_hash: string
  document_revision: number
  projection_reference_date: string
  next_event_seq: number
  archived_at: null
}

interface BootstrapVersion {
  id: number
  version_no: number
  version_name: string | null
  milestone_name: string | null
  status: 'active' | 'frozen'
  content_hash: string | null
  document_revision: number
  projection_reference_date: string
  shared_link_count: number
}

export interface BootstrapPayload {
  scope: BootstrapScope
  version: BootstrapVersion
  counts: {
    unresolved: number
    resolved: number
    detached: number
  }
  threads: unknown[]
  profiles: unknown[]
  accessibleScopes: unknown[]
  lastReadEventSeq: number
  threadReadStates: Array<{
    threadId: string
    latestCommentEventSeq: number
    lastReadEventSeq: number
    unread: boolean
  }>
}

export interface BootstrapRepairEnvelope {
  ownerUserId: string
  resumeId: string
  versionId: number
  documentRevision: number
  snapshot: Record<string, unknown>
  projectionReferenceDate: string
}

export type BootstrapRpcResult =
  | {
      protocolVersion: 1
      status: 'scope_missing'
      access: Pick<BootstrapAccessEnvelope, 'kind' | 'sharePasswordHash'>
      repair: BootstrapRepairEnvelope
    }
  | {
      protocolVersion: 1
      status: 'ok'
      access: BootstrapAccessEnvelope
      bootstrap: BootstrapPayload
      eventSeq: number
    }

export type BootstrapTimingName =
  | 'auth_anonymous'
  | 'auth_local'
  | 'auth_legacy'
  | 'access_token'
  | 'access_rpc'
  | 'mutation_rpc'
  | 'replay'
  | 'rate_limit'
  | 'write_rpc'
  | 'hydrate'
  | 'rpc'
  | 'repair'
  | 'realtime_token'
  | 'serialize'
  | 'edge_total'

export type CommentTimeOperation = <T>(
  name: BootstrapTimingName,
  operation: () => PromiseLike<T>,
) => Promise<T>
