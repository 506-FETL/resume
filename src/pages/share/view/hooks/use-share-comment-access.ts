import type { CommentAccessContext } from '@/features/resume-comments/api/client.ts'
import type { ShareViewResult } from '@/lib/supabase/resume/share.types.ts'
import { useCallback } from 'react'
import {
  ResumeCommentClientError,
} from '@/features/resume-comments/api/client.ts'
import { fetchSharedResume } from '@/lib/supabase/resume/share'

export interface ShareCommentAccess {
  context: Extract<CommentAccessContext, { kind: 'share' }>
  scopeId: string
  expiresAt: string
}

export function readShareCommentAccess(result: ShareViewResult): ShareCommentAccess | null {
  if (
    !result.shareId
    || !result.releaseId
    || !result.commentScopeId
    || !result.commentAccessToken
    || !result.commentAccessExpiresAt
  ) {
    return null
  }
  return {
    context: {
      kind: 'share',
      accessToken: result.commentAccessToken,
      shareId: result.shareId,
      releaseId: result.releaseId,
      commentsEnabled: result.allowComments === true,
    },
    scopeId: result.commentScopeId,
    expiresAt: result.commentAccessExpiresAt,
  }
}

export function useShareCommentAccess({
  token,
  password,
  onRefreshResult,
}: {
  token: string | undefined
  password: string | undefined
  onRefreshResult: (result: ShareViewResult) => void
}) {
  return useCallback(async () => {
    if (!token)
      throw new ResumeCommentClientError('share_unavailable', '分享已不可用')
    const result = await fetchSharedResume(token, password, { refresh: true })
    onRefreshResult(result)
    const access = readShareCommentAccess(result)
    if (!access) {
      throw new ResumeCommentClientError(
        'share_unavailable',
        result.needPassword ? '分享访问状态已变化，请重新验证' : '分享已不可用',
      )
    }
    return access.context
  }, [onRefreshResult, password, token])
}
