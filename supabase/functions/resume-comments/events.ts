import type { CommentApiOp } from '../shared/resume-comment-schema.ts'
import {
  isRecord,
  readNonNegativeInteger,
  CommentApiError,
} from '../shared/resume-comment-schema.ts'
import type { ResolvedAccess, AccessKind, AdminClient } from './types.ts'
import { isUuidValue } from './validation.ts'
import {
  deriveScopeRealtimeTopic,
  issueRealtimeAccess,
  deriveOwnerRealtimeTopic,
  broadcastCommentInvalidation,
} from '../shared/resume-comment-events.ts'
import { loadThreads } from './queries.ts'

const COMMENT_EVENT_TYPE_BY_OP: Partial<Record<CommentApiOp, string>> = {
  sync_working_document: 'document_synced',
  create_thread: 'thread_created',
  create_reply: 'comment_replied',
  edit_comment: 'comment_edited',
  delete_comment: 'comment_deleted',
  delete_thread: 'thread_deleted',
  resolve_thread: 'thread_resolved',
  reopen_thread: 'thread_reopened',
  relink_anchor: 'anchor_relinked',
}

export function resolveCommentEventType(op: CommentApiOp) {
  return COMMENT_EVENT_TYPE_BY_OP[op] ?? op
}

function projectCommentEventsForAccess(
  events: unknown[],
  access: ResolvedAccess,
) {
  return events.flatMap((value) => {
    if (!isRecord(value)) return []

    const sanitizedPayload = isRecord(value.sanitized_payload)
      ? value.sanitized_payload
      : {}

    return [
      {
        event_seq: value.event_seq,
        thread_id: value.thread_id,
        type: value.type,
        sanitized_payload: value.sanitized_payload,
        created_at: value.created_at,
        is_own: Boolean(
          access.actorKind &&
          access.actorId &&
          value.actor_kind === access.actorKind &&
          value.actor_id === access.actorId,
        ),
        ...(isUuidValue(sanitizedPayload.clientRequestId)
          ? { clientRequestId: sanitizedPayload.clientRequestId }
          : {}),
      },
    ]
  })
}

export async function issueTopics({
  access,
  realtimeSecret,
  tokenSecret,
}: {
  access: {
    kind: AccessKind
    scope: { id: string }
    userId: string | null
    versionId: number
  }
  realtimeSecret: string
  tokenSecret: string
}) {
  const scopeTopic = await deriveScopeRealtimeTopic({
    scopeId: access.scope.id,
    versionId: access.versionId,
    secret: realtimeSecret,
  })

  const scopeRealtime = await issueRealtimeAccess({
    ...scopeTopic,
    scopeId: access.scope.id,
    tokenSecret,
  })

  if (access.kind !== 'owner' || !access.userId) {
    return { scopeRealtime, ownerRealtime: null }
  }

  const ownerTopic = await deriveOwnerRealtimeTopic({
    userId: access.userId,
    secret: realtimeSecret,
  })

  return {
    scopeRealtime,
    ownerRealtime: await issueRealtimeAccess({
      ...ownerTopic,
      userId: access.userId,
      tokenSecret,
    }),
  }
}

export async function notifyWrite({
  admin,
  access,
  realtimeSecret,
  eventSeq,
  type,
}: {
  admin: AdminClient
  access: ResolvedAccess
  realtimeSecret: string
  eventSeq: number
  type: string
}) {
  const topics = [
    await deriveScopeRealtimeTopic({
      scopeId: access.scope.id,
      versionId: access.versionId,
      secret: realtimeSecret,
    }),
  ]

  topics.push(
    await deriveOwnerRealtimeTopic({
      userId: access.scope.owner_user_id,
      secret: realtimeSecret,
    }),
  )

  await broadcastCommentInvalidation({
    admin,
    topics: topics.map((item) => item.topic),
    eventSeq,
    type,
  })
}

export async function listCommentEvents({
  admin,
  body,
  access,
  op,
  success,
}: {
  admin: AdminClient
  body: Record<string, unknown>
  access: ResolvedAccess
  op: CommentApiOp
  success: (data: unknown, eventSeq: number) => Response
}): Promise<Response> {
  const afterEventSeq = readNonNegativeInteger(body, 'afterEventSeq', 0)

  const requestedThroughEventSeq = readNonNegativeInteger(
    body,
    'throughEventSeq',
    access.scope.next_event_seq,
  )

  if (
    !Number.isSafeInteger(afterEventSeq) ||
    !Number.isSafeInteger(requestedThroughEventSeq)
  )
    throw new CommentApiError('not_found', '评论分页游标无效', 400)

  // 固定本轮扫描上界；后续新增留待下轮，避免持续写入时无法结束补齐。
  const throughEventSeq = Math.min(
    requestedThroughEventSeq,
    access.scope.next_event_seq,
  )

  const eventResult = await admin
    .from('resume_comment_events')
    .select(
      'id,event_seq,thread_id,type,actor_kind,actor_id,sanitized_payload,created_at',
    )
    .eq('scope_id', access.scope.id)
    .gt('event_seq', afterEventSeq)
    .lte('event_seq', throughEventSeq)
    .order('event_seq', { ascending: true })
    .limit(501)

  if (eventResult.error) throw eventResult.error

  const rows = eventResult.data ?? []
  const events = rows.slice(0, 500)
  // 过滤/投影前推进扫描游标，额外查询的第 501 条仅用于判断下一页。
  const scannedEventSeq = Number(events.at(-1)?.event_seq ?? afterEventSeq)

  const threadIds = Array.from(
    new Set(
      events.flatMap((event) => (event.thread_id ? [event.thread_id] : [])),
    ),
  )

  // 全量线程是当前快照，并不代表快照查询之后的事件已经消费。
  const { threads, profiles } = await loadThreads(
    admin,
    access.scope.id,
    op === 'list_threads' ? undefined : threadIds,
  )

  return success(
    {
      threads,
      profiles,
      events: projectCommentEventsForAccess(events, access),
      hasMore: rows.length > events.length,
      throughEventSeq,
    },
    scannedEventSeq,
  )
}
