import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.103.0'
import type { ResumeCommentRelocationResult } from '../shared/resume-comment-core.ts'

export type AdminClient = SupabaseClient

export type ActorKind = 'user' | 'anonymous'

export type AccessKind = 'owner' | 'collaborator' | 'share'

export type SyncRelocation = ResumeCommentRelocationResult & {
  threadId: string
}

export interface ScopeRow {
  id: string
  kind: 'working' | 'history' | 'share_release' | 'version'
  owner_user_id: string
  resume_id: string
  version_id: number | null
  history_version_id: number | null
  share_release_id: string | null
  anchor_document: {
    nodes?: Array<{
      nodeKey: string
      text: string
      blocks: unknown[]
      nodeTextHash: string
    }>
  }
  document_hash: string
  document_revision: number
  projection_reference_date: string
  next_event_seq: number
  archived_at: string | null
}

export type AccessScopeRow = Omit<ScopeRow, 'anchor_document'>

export interface ShareRow {
  id: string
  user_id: string
  current_release_id: string | null
  allow_comments: boolean
  is_active: boolean
  archived_at: string | null
  expires_at: string | null
  password_hash: string | null
  version_id: number
}

export interface CollaborationSessionRow {
  session_id: string
  resume_id: string
  scope_id: string
  owner_user_id: string
  host_lease_id: string
  default_role: 'editor' | 'viewer'
  expires_at: string
  revoked_at: string | null
  protocol_version: 1 | 2
}

export interface CollaborationDocumentRow {
  document_data: string
  heads: string[]
  document_version: number
  updated_at: string
}

export interface CollaborationMemberRow {
  session_id: string
  user_id: string
  member_lease_id: string
  role: 'editor' | 'viewer'
  expires_at: string
  revoked_at: string | null
  protocol_version: 1 | 2
}

export interface ResolvedAccess {
  kind: AccessKind
  scope: AccessScopeRow
  userId: string | null
  actorKind: ActorKind | null
  actorId: string | null
  actorKey: string | null
  legacyAnonymousId: string | null
  share: ShareRow | null
  releaseId: string | null
  versionId: number
  canWrite: boolean
  canManageAll: boolean
}
