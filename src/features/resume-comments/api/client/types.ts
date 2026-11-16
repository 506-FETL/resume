import type {
  AccessibleCommentScopeSummary,
  CommentScopeSummary,
} from '../../store/types.ts'
import type {
  CommentThreadCounts,
  CommentThreadReadState,
  CommentVersionReference,
  ResumeComment,
  ResumeCommentEvent,
  ResumeCommentThread,
} from '../../types.ts'

export interface AnonymousCommentCredential {
  id: string
  secret: string
}

export type CommentAccessContext =
  | {
      kind: 'owner'
      scopeId: string
    }
  | {
      kind: 'owner'
      resumeId: string
    }
  | {
      kind: 'owner'
      versionId: number
    }
  | {
      kind: 'collaborator'
      accessToken: string
      sessionId: string
      resumeId: string
      userId: string
      role: 'editor' | 'viewer'
      versionId: number
    }
  | {
      kind: 'share'
      accessToken: string
      shareId: string
      releaseId: string
      versionId: number
      commentsEnabled: boolean
      anonymous?: AnonymousCommentCredential | null
    }

export interface CommentRealtimeAccess {
  topic: string
  expiresAt: string
  token: string
}

export interface CommentBootstrapResult {
  scope: CommentScopeSummary
  version: CommentVersionReference
  counts: CommentThreadCounts
  accessibleScopes: AccessibleCommentScopeSummary[]
  threads: ResumeCommentThread[]
  lastReadEventSeq: number
  threadReadStates: CommentThreadReadState[]
  scopeRealtime: CommentRealtimeAccess
  ownerRealtime: CommentRealtimeAccess | null
}

export interface CommentThreadListResult {
  threads: ResumeCommentThread[]
  events: ResumeCommentEvent[]
}

export interface CommentMutationResult {
  thread: ResumeCommentThread | null
  comment: ResumeComment | null
  removedCommentId: string | null
  counts: CommentThreadCounts
  event: ResumeCommentEvent
  threadId: string | null
  commentId: string | null
  revision: number | null
}

export interface CommentDocumentSyncResult {
  versionId: number
  documentRevision: number
  documentHash: string
  threads: ResumeCommentThread[]
  counts: CommentThreadCounts
  event: ResumeCommentEvent
}

export type CommentAuthMode = 'anonymous' | 'local_jwks' | 'legacy_auth'

export type CommentBootstrapClientStage =
  | 'auth_token'
  | 'fetch_headers'
  | 'response_body'
  | 'normalize'
  | 'store_commit'
  | 'realtime_connect'

export interface CommentResponseTelemetry {
  protocolVersion: 1
  authMode: CommentAuthMode
  repair: boolean
  coldStart: boolean
  edgeRegion: string | null
  /** 解码响应文本重新编码后的 UTF-8 字节数。 */
  responseBytes: number
  clientDurations: Partial<Record<CommentBootstrapClientStage, number>>
}

export interface CommentApiSuccess<
  T,
  TTelemetry extends CommentResponseTelemetry | null =
    CommentResponseTelemetry | null,
> {
  data: T
  eventSeq: number
  requestId: string | null
  serverTiming: string | null
  telemetry: TTelemetry
}
