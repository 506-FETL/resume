import type {
  CommentAccessContext,
  ResumeCommentClient,
} from '../../api/client.ts'
import type { ResumeCommentStore } from '../../store/types.ts'

export interface UseCommentRealtimeOptions {
  client: ResumeCommentClient
  store: ResumeCommentStore
  enabled: boolean
  refreshAccess?: () => Promise<CommentAccessContext>
  onAccessInvalidated?: (reason: 'stale_release' | 'share_unavailable') => void
  accessIdentityKey: string
}

export function accessChangedVersion(
  previous: CommentAccessContext,
  next: CommentAccessContext,
) {
  return (
    previous.kind === 'share' &&
    next.kind === 'share' &&
    previous.versionId !== next.versionId
  )
}

export function isReadOnlyAccess(access: CommentAccessContext) {
  return (
    (access.kind === 'share' && !access.commentsEnabled) ||
    (access.kind === 'collaborator' && access.role === 'viewer')
  )
}

export function hasServerReadPrincipal(
  access: CommentAccessContext,
  authenticatedUserId: string | null,
) {
  return (
    access.kind !== 'share' ||
    Boolean(authenticatedUserId) ||
    Boolean(access.anonymous)
  )
}
