import type { CommentAuthor } from '../types.ts'

export interface CommentUiPermissions {
  canCreate: boolean
  canModerateAll: boolean
  currentUserId?: string | null
  currentAnonymousId?: string | null
}

export function isCurrentCommentAuthor(
  author: CommentAuthor,
  permissions: CommentUiPermissions,
) {
  return permissions.canModerateAll
    || (author.kind === 'user' && author.userId === permissions.currentUserId)
    || (author.kind === 'anonymous' && author.anonymousId === permissions.currentAnonymousId)
}
