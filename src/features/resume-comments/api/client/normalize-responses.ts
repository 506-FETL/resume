import type { ResumeCommentEvent, ResumeCommentEventType } from '../../types.ts'
import { ResumeCommentClientError } from './error'
import {
  normalizeAccessibleScope,
  normalizeCounts,
  normalizeRealtimeAccess,
  normalizeScope,
  normalizeThreadReadStates,
  normalizeVersion,
} from './normalize-scopes'
import { normalizeThreads } from './normalize-threads'
import type {
  CommentBootstrapClientStage,
  CommentBootstrapResult,
  CommentMutationResult,
  CommentResponseTelemetry,
} from './types'
import {
  asArray,
  asNullableString,
  asNumber,
  asRecord,
  isCommentAuthMode,
  isUuid,
} from './values'

export const COMMENT_EVENT_TYPES = new Set<ResumeCommentEventType>([
  'thread_created',
  'comment_replied',
  'comment_edited',
  'comment_deleted',
  'thread_deleted',
  'thread_resolved',
  'thread_reopened',
  'anchor_moved',
  'anchor_detached',
  'anchor_relinked',
  'document_synced',
  'settings_changed',
])

export function normalizeEvents(value: unknown): ResumeCommentEvent[] {
  return asArray(value).flatMap((item) => {
    const event = asRecord(item)
    const type = String(event.type ?? '') as ResumeCommentEventType

    const commentId =
      event.commentId ?? asRecord(event.sanitized_payload).commentId

    if (!COMMENT_EVENT_TYPES.has(type)) return []

    return [
      {
        eventSeq: asNumber(event.event_seq),
        type,
        threadId: asNullableString(event.thread_id),
        createdAt: String(event.created_at ?? ''),
        isOwn: event.is_own === true,
        commentId: isUuid(commentId) ? commentId : undefined,
        clientRequestId: isUuid(event.clientRequestId)
          ? event.clientRequestId
          : isUuid(event.client_request_id)
            ? event.client_request_id
            : undefined,
      },
    ]
  })
}

export function normalizeBootstrap(value: unknown): CommentBootstrapResult {
  const data = asRecord(value)

  return {
    scope: normalizeScope(data.scope),
    version: normalizeVersion(data.version),
    counts: normalizeCounts(data.counts),
    accessibleScopes: asArray(data.accessibleScopes).map(
      normalizeAccessibleScope,
    ),
    threads: normalizeThreads(data.threads, data.profiles),
    lastReadEventSeq: asNumber(data.lastReadEventSeq),
    threadReadStates: normalizeThreadReadStates(data.threadReadStates),
    scopeRealtime: normalizeRealtimeAccess(data.scopeRealtime),
    ownerRealtime: data.ownerRealtime
      ? normalizeRealtimeAccess(data.ownerRealtime)
      : null,
  }
}

export function readBootstrapTelemetry({
  result,
  edgeRegion,
  responseBytes,
  clientDurations,
  requestId,
}: {
  result: Record<string, unknown>
  edgeRegion: string | null
  responseBytes: number
  clientDurations: Partial<Record<CommentBootstrapClientStage, number>>
  requestId: string
}): CommentResponseTelemetry {
  const meta = asRecord(result.meta)

  if (
    result.protocolVersion !== 1 ||
    !isCommentAuthMode(meta.authMode) ||
    typeof meta.repair !== 'boolean' ||
    typeof meta.coldStart !== 'boolean'
  ) {
    throw new ResumeCommentClientError(
      'unexpected',
      '评论服务协议不兼容',
      undefined,
      requestId,
    )
  }

  return {
    protocolVersion: 1,
    authMode: meta.authMode,
    repair: meta.repair,
    coldStart: meta.coldStart,
    edgeRegion,
    responseBytes,
    clientDurations,
  }
}

export function normalizeMutation(value: unknown): CommentMutationResult {
  const data = asRecord(value)

  const normalizedThreads = data.thread
    ? normalizeThreads([data.thread], data.profiles)
    : []

  const thread = normalizedThreads[0] ?? null

  const commentId =
    asNullableString(data.commentId) ??
    asNullableString(asRecord(data.comment).id)

  const event = normalizeEvents([data.event])[0] ?? {
    eventSeq: asNumber(asRecord(data.event).event_seq, asNumber(data.eventSeq)),
    type: 'settings_changed',
    threadId: asNullableString(data.threadId),
    createdAt: new Date().toISOString(),
    isOwn: true,
  }

  return {
    thread,
    comment: commentId
      ? (thread?.comments.find((comment) => comment.id === commentId) ?? null)
      : null,
    removedCommentId: asNullableString(data.removedCommentId),
    counts: normalizeCounts(data.counts),
    event: { ...event, commentId: event.commentId ?? commentId ?? undefined },
    threadId: asNullableString(data.threadId),
    commentId,
    revision: data.revision == null ? null : asNumber(data.revision),
  }
}
