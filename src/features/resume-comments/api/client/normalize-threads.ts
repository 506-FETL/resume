import type {
  CommentAuthor,
  ResumeComment,
  ResumeCommentThread,
} from '../../types.ts'
import { asArray, asNullableString, asNumber, asRecord } from './values'

export function buildProfileMap(value: unknown) {
  return new Map(
    asArray(value).map((item) => {
      const profile = asRecord(item)

      return [
        String(profile.id ?? ''),
        {
          displayName: String(profile.full_name ?? '用户'),
          avatarUrl: asNullableString(profile.avatar_url),
        },
      ] as const
    }),
  )
}

export function normalizeAuthor(
  kindValue: unknown,
  userIdValue: unknown,
  anonymousIdValue: unknown,
  profiles: ReturnType<typeof buildProfileMap>,
  deleted = false,
): CommentAuthor {
  if (deleted) {
    return { kind: 'deleted', displayName: '已删除用户' }
  }

  const userId = asNullableString(userIdValue)

  if (kindValue === 'user' && userId) {
    const profile = profiles.get(userId)

    return {
      kind: 'user',
      userId,
      displayName: profile?.displayName ?? '用户',
      avatarUrl: profile?.avatarUrl ?? null,
    }
  }

  const anonymousId = asNullableString(anonymousIdValue)

  if (kindValue === 'anonymous' && anonymousId) {
    return {
      kind: 'anonymous',
      anonymousId,
      displayName: '匿名用户',
      avatarSeed: anonymousId,
    }
  }

  return { kind: 'deleted', displayName: '已删除用户' }
}

export function normalizeComment(
  value: unknown,
  profiles: ReturnType<typeof buildProfileMap>,
): ResumeComment {
  const comment = asRecord(value)
  const deletedAt = asNullableString(comment.deleted_at)

  return {
    id: String(comment.id ?? ''),
    threadId: String(comment.thread_id ?? ''),
    parentId: asNullableString(comment.parent_id),
    author: normalizeAuthor(
      comment.author_kind,
      comment.author_user_id,
      comment.author_anonymous_id,
      profiles,
      Boolean(deletedAt),
    ),
    body: String(comment.body ?? ''),
    editedAt: asNullableString(comment.edited_at),
    deletedAt,
    createdAt: String(comment.created_at ?? ''),
    updatedAt: String(comment.updated_at ?? ''),
  }
}

export function normalizeThreads(
  threadsValue: unknown,
  profilesValue: unknown,
): ResumeCommentThread[] {
  const profiles = buildProfileMap(profilesValue)

  return asArray(threadsValue).map((value) => {
    const thread = asRecord(value)
    const resolvedAt = asNullableString(thread.resolved_at)

    return {
      id: String(thread.id ?? ''),
      scopeId: String(thread.scope_id ?? ''),
      anchor: thread.anchor as ResumeCommentThread['anchor'],
      anchorStatus:
        thread.anchor_status === 'detached' ? 'detached' : 'anchored',
      originalPageIndex:
        thread.original_page_index == null
          ? null
          : asNumber(thread.original_page_index),
      revision: asNumber(thread.revision),
      resolvedAt,
      resolvedBy: resolvedAt
        ? normalizeAuthor(
            thread.resolved_by_kind,
            thread.resolved_by_kind === 'user' ? thread.resolved_by_id : null,
            thread.resolved_by_kind === 'anonymous'
              ? thread.resolved_by_id
              : null,
            profiles,
          )
        : null,
      lastActivityAt: String(thread.last_activity_at ?? ''),
      deletedAt: null,
      comments: asArray(thread.comments)
        .map((comment) => normalizeComment(comment, profiles))
        .sort(
          (left, right) =>
            Date.parse(left.createdAt) - Date.parse(right.createdAt),
        ),
    }
  })
}
