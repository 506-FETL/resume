import type { CommentThreadReadState, ResumeCommentEvent } from '../types.ts'

export function indexCommentThreadReadStates(states: CommentThreadReadState[] = []) {
  return Object.fromEntries(states.map(state => [state.threadId, state]))
}

export function mergeCommentThreadReadStateMaps(
  current: Record<string, CommentThreadReadState>,
  incoming: Record<string, CommentThreadReadState>,
) {
  const merged = { ...current }
  for (const [threadId, state] of Object.entries(incoming)) {
    const existing = merged[threadId]
    merged[threadId] = {
      threadId,
      latestCommentEventSeq: Math.max(
        existing?.latestCommentEventSeq ?? 0,
        state.latestCommentEventSeq,
      ),
      lastReadEventSeq: Math.max(
        existing?.lastReadEventSeq ?? 0,
        state.lastReadEventSeq,
      ),
    }
  }
  return merged
}

export function applyCommentEventsToThreadReadStates(
  current: Record<string, CommentThreadReadState>,
  events: ResumeCommentEvent[],
) {
  const next = { ...current }
  for (const event of events) {
    if (!event.threadId)
      continue
    if (event.type === 'thread_deleted') {
      delete next[event.threadId]
      continue
    }
    if (event.type !== 'thread_created' && event.type !== 'comment_replied')
      continue
    const existing = next[event.threadId]
    const latestCommentEventSeq = Math.max(
      existing?.latestCommentEventSeq ?? 0,
      event.eventSeq,
    )
    next[event.threadId] = {
      threadId: event.threadId,
      latestCommentEventSeq,
      lastReadEventSeq: event.isOwn
        ? Math.max(existing?.lastReadEventSeq ?? 0, event.eventSeq)
        : existing?.lastReadEventSeq ?? 0,
    }
  }
  return next
}

export function isCommentThreadUnread(
  state: CommentThreadReadState,
  scopeLastReadEventSeq: number,
) {
  return state.latestCommentEventSeq > Math.max(
    state.lastReadEventSeq,
    scopeLastReadEventSeq,
  )
}

export function getUnreadCommentThreadIds(
  states: Record<string, CommentThreadReadState>,
  scopeLastReadEventSeq: number,
) {
  return Object.values(states)
    .filter(state => isCommentThreadUnread(state, scopeLastReadEventSeq))
    .map(state => state.threadId)
}
