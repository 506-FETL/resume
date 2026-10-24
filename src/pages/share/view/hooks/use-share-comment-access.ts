import type { CommentAccessContext } from '@/features/resume-comments/api/client.ts'
import type { ShareViewResult } from '@/lib/supabase/resume/share.types.ts'

export interface ShareCommentAccess {
  context: Extract<CommentAccessContext, { kind: 'share' }>
  scopeId: string
  expiresAt: string
}

export function readShareCommentAccess(
  result: ShareViewResult,
): ShareCommentAccess | null {
  if (
    !result.shareId ||
    !result.releaseId ||
    !result.versionId ||
    !result.commentScopeId ||
    !result.commentAccessToken ||
    !result.commentAccessExpiresAt
  ) {
    return null
  }
  return {
    context: {
      kind: 'share',
      accessToken: result.commentAccessToken,
      shareId: result.shareId,
      releaseId: result.releaseId,
      versionId: result.versionId,
      commentsEnabled: result.allowComments === true,
    },
    scopeId: result.commentScopeId,
    expiresAt: result.commentAccessExpiresAt,
  }
}
