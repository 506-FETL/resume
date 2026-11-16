import type { CommentAccessContext } from '../client.ts'
import type { CommentCacheKey } from './types'

export function serializeCommentCacheKey(key: CommentCacheKey) {
  return `version:${key.versionId}:principal:${key.principalKey}`
}

export function deriveCommentCacheKey(
  access: CommentAccessContext,
  resolvedVersionId?: number,
  authenticatedUserId?: string | null,
): CommentCacheKey | null {
  const versionId =
    'versionId' in access
      ? access.versionId
      : (resolvedVersionId ?? readCommentVersionHint(access))

  if (!versionId) return null
  if (access.kind === 'owner') {
    return authenticatedUserId
      ? { versionId, principalKey: `owner:${authenticatedUserId}` }
      : null
  }
  if (access.kind === 'collaborator')
    return { versionId, principalKey: `user:${access.userId}` }

  return {
    versionId,
    principalKey: authenticatedUserId
      ? `user:${authenticatedUserId}`
      : access.anonymous
        ? `anonymous:${access.anonymous.id}`
        : 'share-visitor',
  }
}

export function versionHintKey(resumeId: string) {
  return `resume-comment-version-hint:${resumeId}`
}

export function rememberCommentVersionHint(
  access: CommentAccessContext,
  versionId: number,
) {
  if (
    access.kind !== 'owner' ||
    !('resumeId' in access) ||
    typeof localStorage === 'undefined'
  )
    return

  try {
    localStorage.setItem(versionHintKey(access.resumeId), String(versionId))
  } catch {
    // 缓存提示不可用不影响评论主流程。
  }
}

export function readCommentVersionHint(access: CommentAccessContext) {
  if (
    access.kind !== 'owner' ||
    !('resumeId' in access) ||
    typeof localStorage === 'undefined'
  )
    return undefined

  try {
    const value = Number(localStorage.getItem(versionHintKey(access.resumeId)))

    return Number.isSafeInteger(value) && value > 0 ? value : undefined
  } catch {
    return undefined
  }
}
