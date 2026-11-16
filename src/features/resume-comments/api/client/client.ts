import type {
  CommentAnchor,
  CommentAnchorDocument,
} from '../../anchors/types.ts'
import type { ResumeCommentEvent, ResumeCommentThread } from '../../types.ts'
import { cachedAuthUserId, getCommentAuthToken } from './auth-token'
import { ResumeCommentClientError } from './error'
import {
  normalizeBootstrap,
  normalizeEvents,
  normalizeMutation,
} from './normalize-responses'
import { normalizeCounts } from './normalize-scopes'
import { normalizeThreads } from './normalize-threads'
import { requestComment } from './transport'
import type {
  AnonymousCommentCredential,
  CommentAccessContext,
  CommentApiSuccess,
  CommentBootstrapResult,
  CommentDocumentSyncResult,
  CommentRealtimeAccess,
  CommentResponseTelemetry,
  CommentThreadListResult,
} from './types'
import { asArray, asNumber, asRecord } from './values'

export class ResumeCommentClient {
  private access: CommentAccessContext
  private resolvedOwnerScopeId: string | null = null

  constructor(access: CommentAccessContext) {
    this.access = access
  }

  getAccessContext() {
    return this.access
  }

  setAccessContext(access: CommentAccessContext) {
    const previousAccess = this.access

    this.access =
      this.access.kind === 'share' &&
      access.kind === 'share' &&
      this.access.shareId === access.shareId &&
      access.anonymous === undefined
        ? { ...access, anonymous: this.access.anonymous }
        : access

    if (
      previousAccess.kind !== 'owner' ||
      this.access.kind !== 'owner' ||
      JSON.stringify(previousAccess) !== JSON.stringify(this.access)
    ) {
      this.resolvedOwnerScopeId = null
    }
  }

  setAnonymousCredential(credential: AnonymousCommentCredential | null) {
    if (this.access.kind !== 'share') return

    this.access = { ...this.access, anonymous: credential }
  }

  async hasAuthenticatedSession() {
    return Boolean(await getCommentAuthToken())
  }

  async getAuthenticatedUserId() {
    await getCommentAuthToken()

    return cachedAuthUserId ?? null
  }

  async bootstrapScope(): Promise<
    CommentApiSuccess<CommentBootstrapResult, CommentResponseTelemetry>
  > {
    const response = await this.request<unknown>('bootstrap_scope')

    if (!response.telemetry) {
      throw new ResumeCommentClientError(
        'unexpected',
        '评论服务协议不兼容',
        undefined,
        response.requestId ?? undefined,
      )
    }

    const normalizeStartedAt = performance.now()
    const data = normalizeBootstrap(response.data)

    if (this.access.kind === 'owner') this.resolvedOwnerScopeId = data.scope.id

    const normalizeDuration = performance.now() - normalizeStartedAt

    return {
      ...response,
      data,
      telemetry: {
        ...response.telemetry,
        clientDurations: {
          ...response.telemetry.clientDurations,
          normalize: normalizeDuration,
        },
      },
    }
  }

  async listThreads(
    afterEventSeq: number,
  ): Promise<CommentApiSuccess<CommentThreadListResult>> {
    return this.listCommentPages('list_threads', afterEventSeq)
  }

  async listEvents(
    afterEventSeq: number,
  ): Promise<CommentApiSuccess<CommentThreadListResult>> {
    return this.listCommentPages('list_events', afterEventSeq)
  }

  private async listCommentPages(
    op: 'list_threads' | 'list_events',
    afterEventSeq: number,
  ): Promise<CommentApiSuccess<CommentThreadListResult>> {
    // 整轮分页固定访问上下文，避免切换版本时把两个作用域拼在一起。
    const reader = new ResumeCommentClient(this.access)

    reader.resolvedOwnerScopeId = this.resolvedOwnerScopeId

    const threads = new Map<string, ResumeCommentThread>()
    const events: ResumeCommentEvent[] = []
    let cursor = afterEventSeq
    let throughEventSeq: number | undefined
    let pageOp = op

    while (true) {
      const response = await reader.request<Record<string, unknown>>(pageOp, {
        afterEventSeq: cursor,
        ...(throughEventSeq === undefined ? {} : { throughEventSeq }),
      })

      const rawEvents = asArray(response.data.events)
      const paginated = typeof response.data.hasMore === 'boolean'

      // 兼容旧服务时，只信实际交付事件，不信其可能越过未读事件的顶层序号。
      const nextCursor = paginated
        ? response.eventSeq
        : Math.max(
            cursor,
            ...rawEvents.map((event) => asNumber(asRecord(event).event_seq)),
          )

      const upperBound = paginated
        ? response.data.throughEventSeq
        : response.eventSeq

      if (
        !Number.isSafeInteger(nextCursor) ||
        nextCursor < cursor ||
        typeof upperBound !== 'number' ||
        !Number.isSafeInteger(upperBound) ||
        upperBound < 0 ||
        (paginated &&
          (nextCursor > Math.max(cursor, upperBound) ||
            (throughEventSeq !== undefined && upperBound !== throughEventSeq)))
      ) {
        throw new ResumeCommentClientError('unexpected', '评论分页游标无效')
      }

      throughEventSeq ??= upperBound

      const hasMore = paginated
        ? response.data.hasMore === true
        : rawEvents.length >= 500 && nextCursor < throughEventSeq

      if (hasMore && nextCursor <= cursor)
        throw new ResumeCommentClientError('unexpected', '评论分页游标未推进')

      for (const thread of normalizeThreads(
        response.data.threads,
        response.data.profiles,
      ))
        threads.set(thread.id, thread)

      const pageEvents = normalizeEvents(rawEvents)

      for (const event of pageEvents) {
        if (event.type === 'thread_deleted' && event.threadId)
          threads.delete(event.threadId)
      }

      events.push(...pageEvents)
      cursor = nextCursor

      // 调用方仅在全部成功后提交游标；任一页失败都能从原位置安全重试。
      if (!hasMore) {
        return {
          ...response,
          eventSeq: cursor,
          data: { threads: [...threads.values()], events },
        }
      }

      pageOp = 'list_events'
    }
  }

  issueRealtimeToken(): Promise<
    CommentApiSuccess<{
      scopeRealtime: CommentRealtimeAccess
      ownerRealtime: CommentRealtimeAccess | null
    }>
  > {
    return this.request<{
      scopeRealtime: CommentRealtimeAccess
      ownerRealtime: CommentRealtimeAccess | null
    }>('issue_realtime_token')
  }

  createAnonymousIdentity(
    anonymousSecret: string,
    requestId = crypto.randomUUID(),
  ) {
    return this.request<{ anonymousId: string }>('create_anonymous_identity', {
      anonymousSecret,
      requestId,
    })
  }

  syncWorkingDocument(input: {
    anchorDocument: CommentAnchorDocument
    documentHash: string
    projectionReferenceDate: string
    expectedDocumentRevision: number
  }) {
    return this.writeRaw<Record<string, unknown>>(
      'sync_working_document',
      input,
    ).then((response) => ({
      ...response,
      data: {
        versionId: asNumber(response.data.versionId),
        documentRevision: asNumber(response.data.documentRevision),
        documentHash: String(response.data.documentHash ?? ''),
        threads: normalizeThreads(
          response.data.threads,
          response.data.profiles,
        ),
        counts: normalizeCounts(response.data.counts),
        event: normalizeEvents([response.data.event])[0]!,
      } satisfies CommentDocumentSyncResult,
    }))
  }

  createThread(input: {
    requestId: string
    anchor: CommentAnchor
    body: string
    documentHash: string
    originalPageIndex: number | null
  }) {
    const { requestId, ...payload } = input

    return this.mutate('create_thread', payload, requestId)
  }

  createReply(
    thread: Pick<ResumeCommentThread, 'id' | 'revision'>,
    body: string,
    parentCommentId: string,
    requestId: string,
  ) {
    return this.mutate(
      'create_reply',
      {
        threadId: thread.id,
        parentCommentId,
        expectedRevision: thread.revision,
        body,
      },
      requestId,
    )
  }

  editComment(
    thread: Pick<ResumeCommentThread, 'id' | 'revision'>,
    commentId: string,
    body: string,
  ) {
    return this.mutate('edit_comment', {
      threadId: thread.id,
      commentId,
      expectedRevision: thread.revision,
      body,
    })
  }

  deleteComment(
    thread: Pick<ResumeCommentThread, 'id' | 'revision'>,
    commentId: string,
  ) {
    return this.mutate('delete_comment', {
      threadId: thread.id,
      commentId,
      expectedRevision: thread.revision,
    })
  }

  deleteThread(thread: Pick<ResumeCommentThread, 'id' | 'revision'>) {
    return this.mutate('delete_thread', {
      threadId: thread.id,
      expectedRevision: thread.revision,
    })
  }

  resolveThread(thread: Pick<ResumeCommentThread, 'id' | 'revision'>) {
    return this.mutate('resolve_thread', {
      threadId: thread.id,
      expectedRevision: thread.revision,
    })
  }

  reopenThread(thread: Pick<ResumeCommentThread, 'id' | 'revision'>) {
    return this.mutate('reopen_thread', {
      threadId: thread.id,
      expectedRevision: thread.revision,
    })
  }

  relinkAnchor(
    thread: Pick<ResumeCommentThread, 'id' | 'revision'>,
    anchor: CommentAnchor,
    documentHash: string,
  ) {
    return this.mutate('relink_anchor', {
      threadId: thread.id,
      expectedRevision: thread.revision,
      anchor,
      documentHash,
    })
  }

  markRead(eventSeq: number) {
    return this.writeRaw('mark_read', { eventSeq })
  }

  markThreadRead(threadId: string, eventSeq: number) {
    return this.writeRaw('mark_thread_read', { threadId, eventSeq })
  }

  private async mutate<TInput extends Record<string, unknown>>(
    op: string,
    input: TInput,
    requestId: string = crypto.randomUUID(),
  ) {
    const response = await this.writeRaw(op, input, requestId)

    return { ...response, data: normalizeMutation(response.data) }
  }

  private writeRaw<TInput extends Record<string, unknown>>(
    op: string,
    input: TInput,
    requestId: string = crypto.randomUUID(),
  ) {
    return this.request<Record<string, unknown>>(op, {
      ...input,
      requestId,
    })
  }

  private request<T>(
    op: string,
    input: Record<string, unknown> = {},
  ): Promise<CommentApiSuccess<T>> {
    return requestComment<T>(this.access, this.resolvedOwnerScopeId, op, input)
  }
}
