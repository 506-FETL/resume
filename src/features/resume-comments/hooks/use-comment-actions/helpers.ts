import { getUserDisplayName } from '@/hooks/use-current-user'
import useUserStore from '@/store/user'
import type {
  CommentAuthor,
  CommentThreadCounts,
  ResumeCommentThread,
} from '../../types.ts'

export class CommentScopeChangedError extends Error {
  constructor() {
    super('评论来源已切换，请在当前版本重新操作')
    this.name = 'CommentScopeChangedError'
  }
}

export function countsAfterThreadRemoval(
  thread: ResumeCommentThread,
  counts: CommentThreadCounts,
) {
  if (thread.anchorStatus === 'detached')
    return { ...counts, detached: Math.max(0, counts.detached - 1) }
  if (thread.resolvedAt)
    return { ...counts, resolved: Math.max(0, counts.resolved - 1) }

  return { ...counts, unresolved: Math.max(0, counts.unresolved - 1) }
}

export function getPendingCommentAuthor(): CommentAuthor | undefined {
  const user = useUserStore.getState().currentUser

  if (!user) return undefined

  const avatarUrl = user.user_metadata.avatar_url

  return {
    kind: 'user',
    userId: user.id,
    displayName: getUserDisplayName(user),
    avatarUrl: typeof avatarUrl === 'string' ? avatarUrl : null,
  }
}
