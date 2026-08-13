import type { CommentAnchor, CommentAnchorDocument } from '../anchors/types.ts'
import type {
  AccessibleCommentScopeSummary,
  CommentScopeSummary,
} from '../store/types.ts'
import type {
  CommentAuthor,
  CommentErrorCode,
  ResumeComment,
  ResumeCommentEvent,
  ResumeCommentEventType,
  ResumeCommentThread,
} from '../types.ts'
import supabase from '@/lib/supabase/client'

export interface AnonymousCommentCredential {
  id: string
  secret: string
}

export type CommentAccessContext
  = | {
    kind: 'owner'
    scopeId: string
  }
  | {
    kind: 'collaborator'
    accessToken: string
  }
  | {
    kind: 'share'
    accessToken: string
    shareId: string
    releaseId: string
    commentsEnabled: boolean
    anonymous?: AnonymousCommentCredential | null
  }

export interface CommentRealtimeAccess {
  topic: string
  expiresAt: string
  token: string
}

export interface CommentBootstrapResult {
  scope: CommentScopeSummary
  accessibleScopes: AccessibleCommentScopeSummary[]
  threads: ResumeCommentThread[]
  lastReadEventSeq: number
  scopeRealtime: CommentRealtimeAccess
  ownerRealtime: CommentRealtimeAccess | null
}

export interface CommentThreadListResult {
  threads: ResumeCommentThread[]
  events: ResumeCommentEvent[]
}

export interface CommentApiSuccess<T> {
  data: T
  eventSeq: number
}

export class ResumeCommentClientError extends Error {
  readonly code: CommentErrorCode
  readonly retryAfterSeconds?: number

  constructor(code: CommentErrorCode, message: string, retryAfterSeconds?: number) {
    super(message)
    this.name = 'ResumeCommentClientError'
    this.code = code
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export function isResumeCommentClientError(error: unknown): error is ResumeCommentClientError {
  return error instanceof ResumeCommentClientError
}

const COMMENT_EVENT_TYPES = new Set<ResumeCommentEventType>([
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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asNumber(value: unknown, fallback = 0) {
  const result = Number(value)
  return Number.isFinite(result) ? result : fallback
}

function asNullableString(value: unknown) {
  return typeof value === 'string' ? value : null
}

function normalizeScope(value: unknown): CommentScopeSummary {
  const scope = asRecord(value)
  return {
    id: String(scope.id ?? ''),
    kind: scope.kind === 'history' || scope.kind === 'share_release' ? scope.kind : 'working',
    resumeId: String(scope.resume_id ?? ''),
    ownerUserId: String(scope.owner_user_id ?? ''),
    historyVersionId: scope.history_version_id == null ? null : asNumber(scope.history_version_id),
    shareReleaseId: asNullableString(scope.share_release_id),
    documentHash: String(scope.document_hash ?? ''),
    documentRevision: asNumber(scope.document_revision),
    projectionReferenceDate: String(scope.projection_reference_date ?? ''),
    nextEventSeq: asNumber(scope.next_event_seq),
  }
}

function normalizeAccessibleScope(value: unknown): AccessibleCommentScopeSummary {
  const scope = asRecord(value)
  return {
    id: String(scope.id ?? ''),
    kind: scope.kind === 'history' || scope.kind === 'share_release' ? scope.kind : 'working',
    resumeId: String(scope.resume_id ?? ''),
    historyVersionId: scope.history_version_id == null ? null : asNumber(scope.history_version_id),
    shareReleaseId: asNullableString(scope.share_release_id),
    documentRevision: asNumber(scope.document_revision),
    nextEventSeq: asNumber(scope.next_event_seq),
    updatedAt: String(scope.updated_at ?? ''),
  }
}

function buildProfileMap(value: unknown) {
  return new Map(asArray(value).map((item) => {
    const profile = asRecord(item)
    return [String(profile.id ?? ''), {
      displayName: String(profile.full_name ?? '用户'),
      avatarUrl: asNullableString(profile.avatar_url),
    }] as const
  }))
}

function normalizeAuthor(
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

function normalizeComment(
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

function normalizeThreads(threadsValue: unknown, profilesValue: unknown): ResumeCommentThread[] {
  const profiles = buildProfileMap(profilesValue)
  return asArray(threadsValue).map((value) => {
    const thread = asRecord(value)
    const resolvedAt = asNullableString(thread.resolved_at)
    return {
      id: String(thread.id ?? ''),
      scopeId: String(thread.scope_id ?? ''),
      anchor: thread.anchor as ResumeCommentThread['anchor'],
      anchorStatus: thread.anchor_status === 'detached' ? 'detached' : 'anchored',
      originalPageIndex: thread.original_page_index == null
        ? null
        : asNumber(thread.original_page_index),
      revision: asNumber(thread.revision),
      resolvedAt,
      resolvedBy: resolvedAt
        ? normalizeAuthor(
            thread.resolved_by_kind,
            thread.resolved_by_kind === 'user' ? thread.resolved_by_id : null,
            thread.resolved_by_kind === 'anonymous' ? thread.resolved_by_id : null,
            profiles,
          )
        : null,
      lastActivityAt: String(thread.last_activity_at ?? ''),
      deletedAt: null,
      comments: asArray(thread.comments)
        .map(comment => normalizeComment(comment, profiles))
        .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt)),
    }
  })
}

function normalizeEvents(value: unknown): ResumeCommentEvent[] {
  return asArray(value).flatMap((item) => {
    const event = asRecord(item)
    const type = String(event.type ?? '') as ResumeCommentEventType
    if (!COMMENT_EVENT_TYPES.has(type))
      return []
    return [{
      eventSeq: asNumber(event.event_seq),
      type,
      threadId: asNullableString(event.thread_id),
      createdAt: String(event.created_at ?? ''),
    }]
  })
}

function normalizeRealtimeAccess(value: unknown): CommentRealtimeAccess {
  const access = asRecord(value)
  return {
    topic: String(access.topic ?? ''),
    expiresAt: String(access.expiresAt ?? ''),
    token: String(access.token ?? ''),
  }
}

function normalizeBootstrap(value: unknown): CommentBootstrapResult {
  const data = asRecord(value)
  return {
    scope: normalizeScope(data.scope),
    accessibleScopes: asArray(data.accessibleScopes).map(normalizeAccessibleScope),
    threads: normalizeThreads(data.threads, data.profiles),
    lastReadEventSeq: asNumber(data.lastReadEventSeq),
    scopeRealtime: normalizeRealtimeAccess(data.scopeRealtime),
    ownerRealtime: data.ownerRealtime ? normalizeRealtimeAccess(data.ownerRealtime) : null,
  }
}

export class ResumeCommentClient {
  private access: CommentAccessContext

  constructor(access: CommentAccessContext) {
    this.access = access
  }

  getAccessContext() {
    return this.access
  }

  setAccessContext(access: CommentAccessContext) {
    this.access = this.access.kind === 'share'
      && access.kind === 'share'
      && this.access.shareId === access.shareId
      && access.anonymous === undefined
      ? { ...access, anonymous: this.access.anonymous }
      : access
  }

  setAnonymousCredential(credential: AnonymousCommentCredential | null) {
    if (this.access.kind !== 'share')
      return
    this.access = { ...this.access, anonymous: credential }
  }

  async bootstrapScope(): Promise<CommentApiSuccess<CommentBootstrapResult>> {
    const response = await this.request<unknown>('bootstrap_scope')
    return { ...response, data: normalizeBootstrap(response.data) }
  }

  async listThreads(afterEventSeq: number): Promise<CommentApiSuccess<CommentThreadListResult>> {
    const response = await this.request<Record<string, unknown>>('list_threads', { afterEventSeq })
    return {
      ...response,
      data: {
        threads: normalizeThreads(response.data.threads, response.data.profiles),
        events: normalizeEvents(response.data.events),
      },
    }
  }

  issueRealtimeToken(): Promise<CommentApiSuccess<{
    scopeRealtime: CommentRealtimeAccess
    ownerRealtime: CommentRealtimeAccess | null
  }>> {
    return this.request<{
      scopeRealtime: CommentRealtimeAccess
      ownerRealtime: CommentRealtimeAccess | null
    }>('issue_realtime_token')
  }

  createAnonymousIdentity(anonymousSecret: string, requestId = crypto.randomUUID()) {
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
    return this.write('sync_working_document', input)
  }

  createThread(input: {
    anchor: CommentAnchor
    body: string
    documentHash: string
    originalPageIndex: number | null
  }) {
    return this.write('create_thread', input)
  }

  createReply(thread: Pick<ResumeCommentThread, 'id' | 'revision'>, body: string) {
    return this.write('create_reply', {
      threadId: thread.id,
      expectedRevision: thread.revision,
      body,
    })
  }

  editComment(
    thread: Pick<ResumeCommentThread, 'id' | 'revision'>,
    commentId: string,
    body: string,
  ) {
    return this.write('edit_comment', {
      threadId: thread.id,
      commentId,
      expectedRevision: thread.revision,
      body,
    })
  }

  deleteComment(thread: Pick<ResumeCommentThread, 'id' | 'revision'>, commentId: string) {
    return this.write('delete_comment', {
      threadId: thread.id,
      commentId,
      expectedRevision: thread.revision,
    })
  }

  deleteThread(thread: Pick<ResumeCommentThread, 'id' | 'revision'>) {
    return this.write('delete_thread', {
      threadId: thread.id,
      expectedRevision: thread.revision,
    })
  }

  resolveThread(thread: Pick<ResumeCommentThread, 'id' | 'revision'>) {
    return this.write('resolve_thread', {
      threadId: thread.id,
      expectedRevision: thread.revision,
    })
  }

  reopenThread(thread: Pick<ResumeCommentThread, 'id' | 'revision'>) {
    return this.write('reopen_thread', {
      threadId: thread.id,
      expectedRevision: thread.revision,
    })
  }

  relinkAnchor(
    thread: Pick<ResumeCommentThread, 'id' | 'revision'>,
    anchor: CommentAnchor,
    documentHash: string,
  ) {
    return this.write('relink_anchor', {
      threadId: thread.id,
      expectedRevision: thread.revision,
      anchor,
      documentHash,
    })
  }

  markRead(eventSeq: number) {
    return this.write('mark_read', { eventSeq })
  }

  private write<TInput extends Record<string, unknown>>(op: string, input: TInput) {
    return this.request<Record<string, unknown>>(op, {
      ...input,
      requestId: crypto.randomUUID(),
    })
  }

  private accessBody(): Record<string, unknown> {
    if (this.access.kind === 'owner') {
      return { accessKind: 'owner', scopeId: this.access.scopeId }
    }
    if (this.access.kind === 'collaborator') {
      return { accessKind: 'collaborator', accessToken: this.access.accessToken }
    }
    return {
      accessKind: 'share',
      accessToken: this.access.accessToken,
      ...(this.access.anonymous
        ? {
            anonymous: {
              id: this.access.anonymous.id,
              secret: this.access.anonymous.secret,
            },
          }
        : {}),
    }
  }

  private async request<T>(
    op: string,
    input: Record<string, unknown> = {},
  ): Promise<CommentApiSuccess<T>> {
    const { data: sessionResult } = await supabase.auth.getSession()
    const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resume-comments`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': publishableKey,
          'Authorization': `Bearer ${sessionResult.session?.access_token ?? publishableKey}`,
          'x-client-info': 'resume-app/comments',
        },
        body: JSON.stringify({
          op,
          ...this.accessBody(),
          ...(this.access.kind === 'share' ? { releaseId: this.access.releaseId } : {}),
          ...input,
        }),
      },
    ).catch(() => {
      throw new ResumeCommentClientError('unexpected', '无法连接评论服务')
    })
    const payload = await response.json().catch(() => null)
    const result = asRecord(payload)
    if (!response.ok || result.ok !== true) {
      const error = asRecord(result.error)
      const code = String(error.code ?? 'unexpected') as CommentErrorCode
      throw new ResumeCommentClientError(
        code,
        String(error.message ?? '评论服务暂时不可用'),
        error.retryAfterSeconds == null ? undefined : asNumber(error.retryAfterSeconds),
      )
    }
    return {
      data: result.data as T,
      eventSeq: asNumber(result.eventSeq),
    }
  }
}
