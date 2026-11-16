import { useCallback } from 'react'
import { ensureAnonymousCommentIdentity } from '../../api/anonymous-identity.ts'
import { deriveCommentCacheKey } from '../../api/cache.ts'
import { ResumeCommentClientError } from '../../api/client.ts'
import { useResumeCommentContext } from '../../context.tsx'

export function useCommentReadContext() {
  const { client, store } = useResumeCommentContext()

  const resolveReadContext = useCallback(async () => {
    const access = client.getAccessContext()
    const state = store.getState()
    const versionId = state.version?.versionId
    const scopeId = state.scope?.id ?? null
    const scopeEpoch = state.scopeEpoch
    const authenticatedUserId = await client.getAuthenticatedUserId()

    return {
      access,
      authenticatedUserId,
      scopeId,
      scopeEpoch,
      cacheKey: deriveCommentCacheKey(access, versionId, authenticatedUserId),
      hasServerPrincipal:
        access.kind !== 'share' ||
        Boolean(authenticatedUserId) ||
        Boolean(access.anonymous),
    }
  }, [client, store])

  return resolveReadContext
}

export function useCommentActor() {
  const { client } = useResumeCommentContext()

  const prepareActor = useCallback(async () => {
    const access = client.getAccessContext()

    if (access.kind !== 'share') return

    if (!access.commentsEnabled)
      throw new ResumeCommentClientError(
        'comments_disabled',
        '当前分享已关闭评论',
      )

    if (!(await client.hasAuthenticatedSession()))
      await ensureAnonymousCommentIdentity(client, access.versionId)
  }, [client])

  return prepareActor
}
