export type CommentRealtimeRecovery = 'ignore' | 'incremental' | 'bootstrap'

export function decideCommentRealtimeRecovery(
  lastEventSeq: number,
  incomingEventSeq: number,
): CommentRealtimeRecovery {
  if (incomingEventSeq <= lastEventSeq)
    return 'ignore'
  return incomingEventSeq === lastEventSeq + 1 ? 'incremental' : 'bootstrap'
}
