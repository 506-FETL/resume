import type { CommentAnchor, CommentAnchorDocument } from '../anchors/types.ts'
import type {
  AccessibleCommentScopeSummary,
  CommentScopeSummary,
} from '../store/types.ts'
import type {
  CommentAuthor,
  CommentErrorCode,
  CommentThreadCounts,
  CommentThreadReadState,
  CommentVersionReference,
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
    kind: 'owner'
    resumeId: string
  }
  | {
    kind: 'owner'
    versionId: number
  }
  | {
    kind: 'collaborator'
    accessToken: string
    sessionId: string
    resumeId: string
    userId: string
    role: 'editor' | 'viewer'
    versionId: number
  }
  | {
    kind: 'share'
    accessToken: string
    shareId: string
    releaseId: string
    versionId: number
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
  version: CommentVersionReference
  counts: CommentThreadCounts
  accessibleScopes: AccessibleCommentScopeSummary[]
  threads: ResumeCommentThread[]
  lastReadEventSeq: number
  threadReadStates: CommentThreadReadState[]
  scopeRealtime: CommentRealtimeAccess
  ownerRealtime: CommentRealtimeAccess | null
}

export interface CommentThreadListResult {
  threads: ResumeCommentThread[]
  events: ResumeCommentEvent[]
}

export interface CommentMutationResult {
  thread: ResumeCommentThread | null
  comment: ResumeComment | null
  removedCommentId: string | null
  counts: CommentThreadCounts
  event: ResumeCommentEvent
  threadId: string | null
  commentId: string | null
  revision: number | null
}

export interface CommentDocumentSyncResult {
  versionId: number
  documentRevision: number
  documentHash: string
  threads: ResumeCommentThread[]
  counts: CommentThreadCounts
  event: ResumeCommentEvent
}

export type CommentAuthMode = 'anonymous' | 'local_jwks' | 'legacy_auth'

export type CommentBootstrapClientStage
  = | 'auth_token'
    | 'fetch_headers'
    | 'response_body'
    | 'normalize'
    | 'store_commit'
    | 'realtime_connect'

export interface CommentResponseTelemetry {
  protocolVersion: 1
  authMode: CommentAuthMode
  repair: boolean
  coldStart: boolean
  edgeRegion: string | null
  /** 解码响应文本重新编码后的 UTF-8 字节数。 */
  responseBytes: number
  clientDurations: Partial<Record<CommentBootstrapClientStage, number>>
}

export interface CommentApiSuccess<
  T,
  TTelemetry extends CommentResponseTelemetry | null = CommentResponseTelemetry | null,
> {
  data: T
  eventSeq: number
  requestId: string | null
  serverTiming: string | null
  telemetry: TTelemetry
}

export class ResumeCommentClientError extends Error {
  readonly code: CommentErrorCode
  readonly retryAfterSeconds?: number
  readonly requestId?: string
  readonly details?: unknown

  constructor(
    code: CommentErrorCode,
    message: string,
    retryAfterSeconds?: number,
    requestId?: string,
    details?: unknown,
  ) {
    super(message)
    this.name = 'ResumeCommentClientError'
    this.code = code
    this.retryAfterSeconds = retryAfterSeconds
    this.requestId = requestId
    this.details = details
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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

function isCommentAuthMode(value: unknown): value is CommentAuthMode {
  return value === 'anonymous' || value === 'local_jwks' || value === 'legacy_auth'
}

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
  const anchorDocument = asRecord(scope.anchor_document)
  const nodeOrder = asArray(anchorDocument.nodes).flatMap((value) => {
    const node = asRecord(value)
    return typeof node.nodeKey === 'string' ? [node.nodeKey] : []
  })
  return {
    id: String(scope.id ?? ''),
    kind: 'version',
    resumeId: String(scope.resume_id ?? ''),
    ownerUserId: String(scope.owner_user_id ?? ''),
    versionId: asNumber(scope.version_id),
    documentHash: String(scope.document_hash ?? ''),
    documentRevision: asNumber(scope.document_revision),
    nodeOrder,
    projectionReferenceDate: String(scope.projection_reference_date ?? ''),
    nextEventSeq: asNumber(scope.next_event_seq),
  }
}

function normalizeAccessibleScope(value: unknown): AccessibleCommentScopeSummary {
  const scope = asRecord(value)
  return {
    id: String(scope.id ?? ''),
    kind: 'version',
    resumeId: String(scope.resume_id ?? ''),
    versionId: asNumber(scope.version_id),
    projectionReferenceDate: String(scope.projection_reference_date ?? ''),
    documentRevision: asNumber(scope.document_revision),
    nextEventSeq: asNumber(scope.next_event_seq),
    lastReadEventSeq: asNumber(scope.last_read_event_seq),
    updatedAt: String(scope.updated_at ?? ''),
  }
}

function normalizeVersion(value: unknown): CommentVersionReference {
  const version = asRecord(value)
  return {
    versionId: asNumber(version.id),
    versionNo: asNumber(version.version_no),
    versionName: asNullableString(version.version_name)
      ?? asNullableString(version.milestone_name),
    status: version.status === 'frozen' ? 'frozen' : 'active',
    documentHash: String(version.content_hash ?? ''),
    documentRevision: asNumber(version.document_revision),
    projectionReferenceDate: String(version.projection_reference_date ?? ''),
    sharedLinkCount: asNumber(version.shared_link_count),
  }
}

function normalizeCounts(value: unknown): CommentThreadCounts {
  const counts = asRecord(value)
  return {
    unresolved: asNumber(counts.unresolved),
    resolved: asNumber(counts.resolved),
    detached: asNumber(counts.detached),
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
      isOwn: event.is_own === true,
      clientRequestId: isUuid(event.clientRequestId)
        ? event.clientRequestId
        : isUuid(event.client_request_id)
          ? event.client_request_id
          : undefined,
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

function normalizeThreadReadStates(value: unknown): CommentThreadReadState[] {
  const threadIds = new Set<string>()
  return asArray(value).map((item) => {
    const state = asRecord(item)
    const threadId = String(state.threadId ?? '')
    const latestCommentEventSeq = asNumber(state.latestCommentEventSeq)
    const lastReadEventSeq = asNumber(state.lastReadEventSeq)
    if (
      !threadId
      || threadIds.has(threadId)
      || latestCommentEventSeq < 0
      || lastReadEventSeq < 0
    ) {
      throw new ResumeCommentClientError('unexpected', '评论已读状态协议不兼容')
    }
    threadIds.add(threadId)
    return { threadId, latestCommentEventSeq, lastReadEventSeq }
  })
}

function normalizeBootstrap(value: unknown): CommentBootstrapResult {
  const data = asRecord(value)
  return {
    scope: normalizeScope(data.scope),
    version: normalizeVersion(data.version),
    counts: normalizeCounts(data.counts),
    accessibleScopes: asArray(data.accessibleScopes).map(normalizeAccessibleScope),
    threads: normalizeThreads(data.threads, data.profiles),
    lastReadEventSeq: asNumber(data.lastReadEventSeq),
    threadReadStates: normalizeThreadReadStates(data.threadReadStates),
    scopeRealtime: normalizeRealtimeAccess(data.scopeRealtime),
    ownerRealtime: data.ownerRealtime ? normalizeRealtimeAccess(data.ownerRealtime) : null,
  }
}

function readBootstrapTelemetry({
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
    result.protocolVersion !== 1
    || !isCommentAuthMode(meta.authMode)
    || typeof meta.repair !== 'boolean'
    || typeof meta.coldStart !== 'boolean'
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

function normalizeMutation(value: unknown): CommentMutationResult {
  const data = asRecord(value)
  const normalizedThreads = data.thread
    ? normalizeThreads([data.thread], data.profiles)
    : []
  const thread = normalizedThreads[0] ?? null
  const commentId = asNullableString(data.commentId)
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
      ? thread?.comments.find(comment => comment.id === commentId) ?? null
      : null,
    removedCommentId: asNullableString(data.removedCommentId),
    counts: normalizeCounts(data.counts),
    event,
    threadId: asNullableString(data.threadId),
    commentId,
    revision: data.revision == null ? null : asNumber(data.revision),
  }
}

let cachedAuthToken: string | null | undefined
let cachedAuthUserId: string | null | undefined
let authTokenPromise: Promise<string | null> | null = null
let authListenerStarted = false

function startAuthTokenListener() {
  if (authListenerStarted)
    return
  authListenerStarted = true
  supabase.auth.onAuthStateChange((_event, session) => {
    cachedAuthToken = session?.access_token ?? null
    cachedAuthUserId = session?.user.id ?? null
    authTokenPromise = null
  })
}

export async function getCommentAuthToken() {
  startAuthTokenListener()
  if (cachedAuthToken !== undefined)
    return cachedAuthToken
  authTokenPromise ??= supabase.auth.getSession().then(({ data }) => {
    cachedAuthToken = data.session?.access_token ?? null
    cachedAuthUserId = data.session?.user.id ?? null
    return cachedAuthToken
  })
  return authTokenPromise
}

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
    this.access = this.access.kind === 'share'
      && access.kind === 'share'
      && this.access.shareId === access.shareId
      && access.anonymous === undefined
      ? { ...access, anonymous: this.access.anonymous }
      : access
    if (
      previousAccess.kind !== 'owner'
      || this.access.kind !== 'owner'
      || JSON.stringify(previousAccess) !== JSON.stringify(this.access)
    ) {
      this.resolvedOwnerScopeId = null
    }
  }

  setAnonymousCredential(credential: AnonymousCommentCredential | null) {
    if (this.access.kind !== 'share')
      return
    this.access = { ...this.access, anonymous: credential }
  }

  async hasAuthenticatedSession() {
    return Boolean(await getCommentAuthToken())
  }

  async getAuthenticatedUserId() {
    await getCommentAuthToken()
    return cachedAuthUserId ?? null
  }

  async bootstrapScope(): Promise<CommentApiSuccess<CommentBootstrapResult, CommentResponseTelemetry>> {
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
    if (this.access.kind === 'owner')
      this.resolvedOwnerScopeId = data.scope.id
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

  async listEvents(afterEventSeq: number): Promise<CommentApiSuccess<CommentThreadListResult>> {
    const response = await this.request<Record<string, unknown>>('list_events', { afterEventSeq })
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
    return this.writeRaw<Record<string, unknown>>('sync_working_document', input)
      .then(response => ({
        ...response,
        data: {
          versionId: asNumber(response.data.versionId),
          documentRevision: asNumber(response.data.documentRevision),
          documentHash: String(response.data.documentHash ?? ''),
          threads: normalizeThreads(response.data.threads, response.data.profiles),
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
    return this.mutate('create_reply', {
      threadId: thread.id,
      parentCommentId,
      expectedRevision: thread.revision,
      body,
    }, requestId)
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

  deleteComment(thread: Pick<ResumeCommentThread, 'id' | 'revision'>, commentId: string) {
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
    requestId = crypto.randomUUID(),
  ) {
    const response = await this.writeRaw(op, input, requestId)
    return { ...response, data: normalizeMutation(response.data) }
  }

  private writeRaw<TInput extends Record<string, unknown>>(
    op: string,
    input: TInput,
    requestId = crypto.randomUUID(),
  ) {
    return this.request<Record<string, unknown>>(op, {
      ...input,
      requestId,
    })
  }

  private accessBody(access: CommentAccessContext): Record<string, unknown> {
    if (access.kind === 'owner') {
      return {
        accessKind: 'owner',
        ...(this.resolvedOwnerScopeId
          ? { scopeId: this.resolvedOwnerScopeId }
          : 'scopeId' in access
            ? { scopeId: access.scopeId }
            : 'versionId' in access
              ? { versionId: access.versionId }
              : { resumeId: access.resumeId }),
      }
    }
    if (access.kind === 'collaborator') {
      return {
        accessKind: 'collaborator',
        accessToken: access.accessToken,
        versionId: access.versionId,
      }
    }
    return {
      accessKind: 'share',
      accessToken: access.accessToken,
      versionId: access.versionId,
      ...(access.anonymous
        ? {
            anonymous: {
              id: access.anonymous.id,
              secret: access.anonymous.secret,
            },
          }
        : {}),
    }
  }

  private async request<T>(
    op: string,
    input: Record<string, unknown> = {},
  ): Promise<CommentApiSuccess<T>> {
    // 请求入口同步冻结作用域；鉴权等待期间切换版本时，旧请求不能借用新 access。
    const access = this.access
    const accessBody = this.accessBody(access)
    const clientDurations: Partial<Record<CommentBootstrapClientStage, number>> = {}
    const authStartedAt = performance.now()
    const authToken = await getCommentAuthToken()
    clientDurations.auth_token = performance.now() - authStartedAt
    const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
    const requestId = isUuid(input.requestId) ? input.requestId : crypto.randomUUID()
    const url = new URL(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resume-comments`)
    const region = import.meta.env.VITE_RESUME_COMMENTS_FUNCTION_REGION ?? 'auto'
    if (region !== 'auto')
      url.searchParams.set('forceFunctionRegion', region)
    const requestHeaders = {
      'Content-Type': 'application/json',
      'apikey': publishableKey,
      'Authorization': `Bearer ${authToken ?? publishableKey}`,
      'x-client-info': 'resume-app/comments',
      'x-request-id': requestId,
    }
    const requestBody = JSON.stringify({
      op,
      ...accessBody,
      ...(access.kind === 'share'
        ? { releaseId: access.releaseId, versionId: access.versionId }
        : {}),
      ...input,
    })
    const fetchStartedAt = performance.now()
    const response = await fetch(
      url,
      {
        method: 'POST',
        headers: requestHeaders,
        body: requestBody,
      },
    ).catch(() => {
      throw new ResumeCommentClientError(
        'unexpected',
        '无法连接评论服务',
        undefined,
        requestId,
      )
    })
    clientDurations.fetch_headers = performance.now() - fetchStartedAt
    const responseRequestIdHeader = response.headers.get('x-request-id')
    const responseRequestId = isUuid(responseRequestIdHeader)
      ? responseRequestIdHeader
      : requestId
    const responseBodyStartedAt = performance.now()
    let responseText = ''
    let payload: unknown = null
    try {
      responseText = await response.text()
      payload = JSON.parse(responseText)
    }
    catch {
      payload = null
    }
    clientDurations.response_body = performance.now() - responseBodyStartedAt
    const result = asRecord(payload)
    if (!response.ok || result.ok !== true) {
      const error = asRecord(result.error)
      const code = String(error.code ?? 'unexpected') as CommentErrorCode
      throw new ResumeCommentClientError(
        code,
        String(error.message ?? '评论服务暂时不可用'),
        error.retryAfterSeconds == null ? undefined : asNumber(error.retryAfterSeconds),
        responseRequestId,
        error.details,
      )
    }
    const hasTelemetryEnvelope = result.protocolVersion === 1
      && Object.keys(asRecord(result.meta)).length > 0
    const telemetry = op === 'bootstrap_scope' || hasTelemetryEnvelope
      ? readBootstrapTelemetry({
          result,
          edgeRegion: response.headers.get('x-sb-edge-region')?.trim() || null,
          responseBytes: new TextEncoder().encode(responseText).byteLength,
          clientDurations,
          requestId: responseRequestId,
        })
      : null
    return {
      data: result.data as T,
      eventSeq: asNumber(result.eventSeq),
      requestId: responseRequestId,
      serverTiming: response.headers.get('server-timing'),
      telemetry,
    }
  }
}
