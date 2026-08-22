import type { ResumeComment, ResumeCommentThread } from '../types.ts'
import type { PendingCommentCreation, PendingReplyCreation, PendingThreadCreation } from './types.ts'

export const LOCAL_THREAD_ID_PREFIX = 'local-thread:'
export const LOCAL_COMMENT_ID_PREFIX = 'local-comment:'

const LOCAL_COMMENT_AUTHOR = {
  kind: 'user',
  userId: 'local',
  displayName: '我',
  avatarUrl: null,
} as const

export function createPendingThreadRecord(
  input: Omit<PendingThreadCreation, 'kind' | 'threadId' | 'commentId'>,
): PendingThreadCreation {
  return {
    ...input,
    kind: 'thread',
    threadId: `${LOCAL_THREAD_ID_PREFIX}${input.requestId}`,
    commentId: `${LOCAL_COMMENT_ID_PREFIX}${input.requestId}`,
  }
}

export function createPendingReplyRecord(
  input: Omit<PendingReplyCreation, 'kind' | 'commentId'>,
): PendingReplyCreation {
  return {
    ...input,
    kind: 'reply',
    commentId: `${LOCAL_COMMENT_ID_PREFIX}${input.requestId}`,
  }
}

function createPendingComment(pending: PendingCommentCreation): ResumeComment {
  return {
    id: pending.commentId,
    threadId: pending.threadId,
    parentId: pending.kind === 'reply' ? pending.parentCommentId : null,
    author: LOCAL_COMMENT_AUTHOR,
    body: pending.body,
    editedAt: null,
    deletedAt: null,
    createdAt: pending.createdAt,
    updatedAt: pending.createdAt,
    delivery: {
      requestId: pending.requestId,
      state: 'sending',
      errorMessage: null,
    },
  }
}

export function createPendingThread(pending: PendingThreadCreation): ResumeCommentThread {
  return {
    id: pending.threadId,
    scopeId: pending.scopeId,
    anchor: pending.anchor,
    anchorStatus: 'anchored',
    originalPageIndex: pending.originalPageIndex,
    revision: 0,
    resolvedAt: null,
    resolvedBy: null,
    lastActivityAt: pending.createdAt,
    deletedAt: null,
    comments: [createPendingComment(pending)],
    localOnly: true,
  }
}

export function appendPendingReply(
  thread: ResumeCommentThread,
  pending: PendingReplyCreation,
): ResumeCommentThread {
  if (thread.comments.some(comment => comment.id === pending.commentId))
    return thread
  return {
    ...thread,
    lastActivityAt: pending.createdAt,
    comments: [...thread.comments, createPendingComment(pending)],
  }
}

export function removePendingCreationFromThreads(
  threadsById: Record<string, ResumeCommentThread>,
  pending: PendingCommentCreation,
): Record<string, ResumeCommentThread> {
  const next = { ...threadsById }
  if (pending.kind === 'thread') {
    delete next[pending.threadId]
    return next
  }

  const thread = next[pending.threadId]
  if (!thread)
    return next
  next[pending.threadId] = {
    ...thread,
    comments: thread.comments.filter(comment => comment.id !== pending.commentId),
  }
  return next
}

export function updatePendingCreationDelivery(
  threadsById: Record<string, ResumeCommentThread>,
  pending: PendingCommentCreation,
  state: 'sending' | 'failed',
  errorMessage: string | null,
): Record<string, ResumeCommentThread> {
  const thread = threadsById[pending.threadId]
  if (!thread)
    return threadsById
  return {
    ...threadsById,
    [pending.threadId]: {
      ...thread,
      comments: thread.comments.map(comment => comment.id === pending.commentId
        ? {
            ...comment,
            delivery: { requestId: pending.requestId, state, errorMessage },
          }
        : comment),
    },
  }
}

export function mergePendingCreationsIntoThreads(
  incomingThreads: ResumeCommentThread[],
  currentThreadsById: Record<string, ResumeCommentThread>,
  pendingCreations: Record<string, PendingCommentCreation>,
): Record<string, ResumeCommentThread> {
  const threadsById = Object.fromEntries(incomingThreads.map(thread => [thread.id, thread]))
  for (const pending of Object.values(pendingCreations)) {
    const currentThread = currentThreadsById[pending.threadId]
    if (!currentThread)
      continue
    if (pending.kind === 'thread') {
      threadsById[pending.threadId] = currentThread
      continue
    }
    const incomingThread = threadsById[pending.threadId]
    if (incomingThread)
      threadsById[pending.threadId] = appendPendingReply(incomingThread, pending)
  }
  return threadsById
}
