import type { AdminClient, ResolvedAccess } from './types.ts'
import type { CommentApiOp } from '../shared/resume-comment-schema.ts'
import {
  readRequestId,
  readUuid,
  readNonNegativeInteger,
  CommentApiError,
  isRecord,
  readCommentAnchor,
  readRequiredString,
  normalizeCommentBody,
} from '../shared/resume-comment-schema.ts'
import type {
  CommentTimeOperation,
  BootstrapTimingName,
} from './bootstrap-types.ts'
import {
  requireActor,
  readReplay,
  requireWrite,
  hashNetworkKey,
  getClientAddress,
} from './write-access.ts'
import { writePayload } from './write-payload.ts'
import { scheduleBackground } from '../shared/operation-metrics.ts'
import { notifyWrite, resolveCommentEventType } from './events.ts'

export async function executeCommentMutation({
  req,
  admin,
  body,
  access,
  op,
  anonymousPepper,
  realtimeSecret,
  success,
  timeOperation,
  recordTiming,
}: {
  req: Request
  admin: AdminClient
  body: Record<string, unknown>
  access: ResolvedAccess
  op: CommentApiOp
  anonymousPepper: string
  realtimeSecret: string
  success: (data: unknown, eventSeq: number) => Response
  timeOperation: CommentTimeOperation
  recordTiming: (name: BootstrapTimingName, duration: number) => void
}): Promise<Response> {
  requireActor(access)

  const requestId = readRequestId(body)

  if (access.kind === 'share') {
    const expectedReleaseId = readUuid(body, 'releaseId')
    const expectedVersionId = readNonNegativeInteger(body, 'versionId')

    if (
      expectedReleaseId !== access.releaseId ||
      expectedVersionId !== access.versionId
    ) {
      throw new CommentApiError(
        'stale_release',
        '分享已发布新版本，请刷新后重试',
        409,
      )
    }
  }

  const replay = ['mark_thread_read', 'mark_read'].includes(op)
    ? await readReplay(admin, access.actorKey!, requestId)
    : null

  if (op === 'mark_thread_read') {
    if (replay) {
      if (!isRecord(replay))
        throw new CommentApiError('unexpected', '评论已读响应无效', 500)

      return success(replay, Number(replay.eventSeq))
    }

    const threadId = readUuid(body, 'threadId')
    const eventSeq = readNonNegativeInteger(body, 'eventSeq')

    const { data, error } = await admin.rpc(
      'mark_resume_comment_thread_read_v1',
      {
        p_scope_id: access.scope.id,
        p_thread_id: threadId,
        p_actor_kind: access.actorKind,
        p_actor_id: access.actorId,
        p_actor_key: access.actorKey,
        p_request_id: requestId,
        p_event_seq: eventSeq,
      },
    )

    if (error) throw error

    return success(data, Number(data.eventSeq))
  }

  const payload = writePayload(body, access)

  if (op === 'mark_read') {
    if (replay) {
      if (!isRecord(replay))
        throw new CommentApiError('unexpected', '评论重试响应无效', 500)

      return success(replay, Number(replay.eventSeq))
    }

    payload.eventSeq = readNonNegativeInteger(body, 'eventSeq')

    const result = await admin.rpc('execute_resume_version_comment_write', {
      p_op: op,
      p_scope_id: access.scope.id,
      p_actor_kind: access.actorKind,
      p_actor_id: access.actorId,
      p_actor_key: access.actorKey,
      p_request_id: requestId,
      p_payload: payload,
    })

    if (result.error) throw result.error
    if (!isRecord(result.data))
      throw new CommentApiError('unexpected', '评论已读响应无效', 500)

    return success(result.data, Number(result.data.eventSeq))
  }

  if (['create_thread', 'relink_anchor'].includes(op)) {
    payload.anchor = readCommentAnchor(body.anchor)
    payload.documentHash = readRequiredString(body, 'documentHash', 64)
  }
  if (['create_thread', 'create_reply', 'edit_comment'].includes(op))
    payload.body = normalizeCommentBody(body.body)
  if (op === 'create_reply')
    payload.parentCommentId = readUuid(body, 'parentCommentId')

  requireWrite(access)

  if (op === 'delete_thread' && !access.canManageAll) {
    throw new CommentApiError(
      'unauthorized',
      '只有简历所有者可以删除整条线程',
      403,
    )
  }
  if (
    [
      'create_reply',
      'edit_comment',
      'delete_comment',
      'delete_thread',
      'resolve_thread',
      'reopen_thread',
      'relink_anchor',
    ].includes(op)
  ) {
    payload.threadId = readUuid(body, 'threadId')
    payload.expectedRevision = readNonNegativeInteger(body, 'expectedRevision')
  }
  if (['edit_comment', 'delete_comment'].includes(op))
    payload.commentId = readUuid(body, 'commentId')

  const networkKey = await hashNetworkKey(
    getClientAddress(req),
    anonymousPepper,
  )

  const mutationResult = await timeOperation('mutation_rpc', () =>
    admin.rpc('execute_resume_comment_mutation_v1', {
      p_op: op,
      p_scope_id: access.scope.id,
      p_actor_kind: access.actorKind,
      p_actor_id: access.actorId,
      p_actor_key: access.actorKey,
      p_request_id: requestId,
      p_payload: payload,
      p_network_key: networkKey,
      p_share_id: access.share?.id ?? null,
    }),
  )

  if (mutationResult.error) throw mutationResult.error
  if (!isRecord(mutationResult.data))
    throw new CommentApiError('unexpected', '评论响应无效', 500)

  const databaseTimings = isRecord(mutationResult.data.timings)
    ? mutationResult.data.timings
    : {}

  for (const timingName of [
    'replay',
    'rate_limit',
    'write_rpc',
    'hydrate',
  ] as const) {
    const duration = Number(databaseTimings[timingName])

    if (Number.isFinite(duration) && duration >= 0)
      recordTiming(timingName, duration)
  }

  if (mutationResult.data.status === 'rate_limited') {
    throw new CommentApiError(
      'rate_limited',
      '操作过于频繁，请稍后重试',
      429,
      Number(mutationResult.data.retryAfterSeconds) || 1,
    )
  }
  if (
    mutationResult.data.status !== 'ok' ||
    !isRecord(mutationResult.data.data)
  )
    throw new CommentApiError('unexpected', '评论响应无效', 500)

  const data = mutationResult.data.data
  const eventSeq = Number(data.eventSeq)

  if (mutationResult.data.replayed !== true) {
    scheduleBackground(
      notifyWrite({
        admin,
        access,
        realtimeSecret,
        eventSeq,
        type: resolveCommentEventType(op),
      }),
    )
  }

  return success(data, eventSeq)
}
