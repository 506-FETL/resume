import type { CommentAnchor } from './anchors/types.ts'

export type CommentScopeKind = 'working' | 'history' | 'share_release'

export type CommentActor
  = | { kind: 'user', userId: string }
    | { kind: 'anonymous', anonymousId: string, secret: string }

export type CommentAuthor
  = | { kind: 'user', userId: string, displayName: string, avatarUrl: string | null }
    | { kind: 'anonymous', anonymousId: string, displayName: '匿名用户', avatarSeed: string }
    | { kind: 'deleted', displayName: '已删除用户' }

export type CommentAccess
  = | { kind: 'owner', ownerUserId: string }
    | { kind: 'collaborator', userId: string, sessionId: string, role: 'editor' | 'viewer' }
    | { kind: 'share_visitor', actor: CommentActor, shareId: string, releaseId: string, commentsEnabled: boolean }

export type CommentPermissions
  = | {
    kind: 'owner'
    canRead: true
    canCreate: true
    canModerate: true
    canManageSettings: true
  }
  | {
    kind: 'collaborator_editor'
    canRead: true
    canCreate: true
    canModerateOwnThreads: true
  }
  | {
    kind: 'collaborator_viewer'
    canRead: true
    canCreate: false
  }
  | {
    kind: 'share_writer'
    canRead: true
    canCreate: true
    canManageOwnContent: true
  }
  | {
    kind: 'share_reader'
    canRead: true
    canCreate: false
  }

export interface CommentScopeReference {
  id: string
  kind: CommentScopeKind
  resumeId: string
  ownerUserId: string
  documentHash: string
  documentRevision: number
  projectionReferenceDate: string
  source:
    | { kind: 'working' }
    | { kind: 'history', historyVersionId: number }
    | { kind: 'share_release', shareId: string, releaseId: string, releaseNo: number }
}

export interface ResumeComment {
  id: string
  threadId: string
  parentId: string | null
  author: CommentAuthor
  body: string
  editedAt: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ResumeCommentThread {
  id: string
  scopeId: string
  anchor: CommentAnchor
  anchorStatus: 'anchored' | 'detached'
  originalPageIndex: number | null
  revision: number
  resolvedAt: string | null
  resolvedBy: CommentAuthor | null
  lastActivityAt: string
  deletedAt: string | null
  comments: ResumeComment[]
}

export type ResumeCommentEventType
  = | 'thread_created'
    | 'comment_replied'
    | 'comment_edited'
    | 'comment_deleted'
    | 'thread_deleted'
    | 'thread_resolved'
    | 'thread_reopened'
    | 'anchor_moved'
    | 'anchor_detached'
    | 'anchor_relinked'
    | 'document_synced'
    | 'settings_changed'

export interface ResumeCommentEvent {
  eventSeq: number
  type: ResumeCommentEventType
  threadId: string | null
  createdAt: string
}

export type CommentErrorCode
  = | 'unauthorized'
    | 'share_unavailable'
    | 'comments_disabled'
    | 'stale_release'
    | 'stale_document'
    | 'stale_revision'
    | 'invalid_selection'
    | 'anchor_detached'
    | 'rate_limited'
    | 'content_too_long'
    | 'not_found'
    | 'unexpected'

export function resolveCommentPermissions(access: CommentAccess): CommentPermissions {
  if (access.kind === 'owner') {
    return {
      kind: 'owner',
      canRead: true,
      canCreate: true,
      canModerate: true,
      canManageSettings: true,
    }
  }
  if (access.kind === 'collaborator') {
    return access.role === 'editor'
      ? {
          kind: 'collaborator_editor',
          canRead: true,
          canCreate: true,
          canModerateOwnThreads: true,
        }
      : {
          kind: 'collaborator_viewer',
          canRead: true,
          canCreate: false,
        }
  }
  return access.commentsEnabled
    ? {
        kind: 'share_writer',
        canRead: true,
        canCreate: true,
        canManageOwnContent: true,
      }
    : {
        kind: 'share_reader',
        canRead: true,
        canCreate: false,
      }
}
