export type CommentRealtimeRecovery = 'ignore' | 'incremental' | 'bootstrap'

export function decideCommentRealtimeRecovery(
  lastEventSeq: number,
  incomingEventSeq: number,
): CommentRealtimeRecovery {
  if (incomingEventSeq <= lastEventSeq)
    return 'ignore'
  // 服务端保留有序事件日志；无论单个事件还是序号断档都先增量补齐。
  // 只有协议不兼容或事件日志明确不可用时才由调用方 bootstrap。
  return 'incremental'
}
