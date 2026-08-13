/* global Deno */

import type {
  CommentAnchorDocumentNode,
  ResumeCommentAnchor,
  ResumeCommentRelocationResult,
} from '../shared/resume-comment-core.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../shared/cors.ts'
import {
  derivePasswordGeneration,
  hashAnonymousSecret,
  timingSafeStringEqual,
  verifyCommentToken,
} from '../shared/resume-comment-auth.ts'
import {
  buildCommentAnchorDocument,
  relocateResumeCommentAnchor,
  sha256Hex,
  stableStringify,
} from '../shared/resume-comment-core.ts'
import {
  broadcastCommentInvalidation,
  deriveOwnerRealtimeTopic,
  deriveScopeRealtimeTopic,
  issueRealtimeAccess,
} from '../shared/resume-comment-events.ts'
import {
  CommentApiError,
  isRecord,
  normalizeCommentBody,
  readCommentAnchor,
  readCommentOp,
  readNonNegativeInteger,
  readRequestId,
  readRequiredString,
  readUuid,
} from '../shared/resume-comment-schema.ts'

const jsonHeaders = {
  ...corsHeaders,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
}

function createAdminClient(url: string, serviceRoleKey: string) {
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

type AdminClient = ReturnType<typeof createAdminClient>
type ActorKind = 'user' | 'anonymous'
type AccessKind = 'owner' | 'collaborator' | 'share'
type SyncRelocation = ResumeCommentRelocationResult & { threadId: string }

interface ScopeRow {
  id: string
  kind: 'working' | 'history' | 'share_release'
  owner_user_id: string
  resume_id: string
  history_version_id: number | null
  share_release_id: string | null
  anchor_document: {
    nodes?: Array<{ nodeKey: string, text: string, blocks: unknown[], nodeTextHash: string }>
  }
  document_hash: string
  document_revision: number
  projection_reference_date: string
  next_event_seq: number
}

interface ShareRow {
  id: string
  user_id: string
  current_release_id: string | null
  allow_comments: boolean
  is_active: boolean
  archived_at: string | null
  expires_at: string | null
  password_hash: string | null
}

interface ResolvedAccess {
  kind: AccessKind
  scope: ScopeRow
  userId: string | null
  actorKind: ActorKind | null
  actorId: string | null
  actorKey: string | null
  legacyAnonymousId: string | null
  share: ShareRow | null
  releaseId: string | null
  canWrite: boolean
  canManageAll: boolean
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders })
}

function success(data: unknown, eventSeq: number) {
  return json({ ok: true, data, eventSeq })
}

function failure(error: CommentApiError) {
  return json({
    ok: false,
    error: {
      code: error.code,
      message: error.message,
      ...(error.retryAfterSeconds
        ? { retryAfterSeconds: error.retryAfterSeconds }
        : {}),
    },
  }, error.status)
}

function getClientAddress(req: Request) {
  return req.headers.get('cf-connecting-ip')
    ?? req.headers.get('x-real-ip')
    ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? 'unknown'
}

async function hashNetworkKey(value: string, pepper: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${pepper}:network:${value}`),
  )
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

async function authenticateUser(req: Request, admin: AdminClient) {
  const jwt = (req.headers.get('Authorization') ?? '')
    .replace(/^Bearer\s+/iu, '')
    .trim()
  if (!jwt) {
    return null
  }
  const { data, error } = await admin.auth.getUser(jwt)
  return error ? null : data.user?.id ?? null
}

async function getScope(admin: AdminClient, scopeId: string): Promise<ScopeRow> {
  const { data, error } = await admin
    .from('resume_comment_scopes')
    .select('id,kind,owner_user_id,resume_id,history_version_id,share_release_id,anchor_document,document_hash,document_revision,projection_reference_date,next_event_seq')
    .eq('id', scopeId)
    .maybeSingle()
  if (error || !data) {
    throw new CommentApiError('not_found', '评论空间不存在', 404)
  }
  return data as ScopeRow
}

async function resolveAnonymousIdentity({
  admin,
  body,
  shareId,
  pepper,
  required,
}: {
  admin: AdminClient
  body: Record<string, unknown>
  shareId: string
  pepper: string
  required: boolean
}): Promise<string | null> {
  const anonymous = body.anonymous
  if (!isRecord(anonymous)) {
    if (required) {
      throw new CommentApiError('unauthorized', '请先创建匿名评论身份', 401)
    }
    return null
  }
  const anonymousId = readUuid(anonymous, 'id')
  const secret = readRequiredString(anonymous, 'secret', 128)
  const expectedHash = await hashAnonymousSecret(secret, pepper)
  const { data, error } = await admin
    .from('resume_comment_anonymous_identities')
    .select('id,share_id,secret_hash,revoked_at')
    .eq('id', anonymousId)
    .maybeSingle()
  if (
    error
    || !data
    || data.share_id !== shareId
    || data.revoked_at
    || !timingSafeStringEqual(expectedHash, data.secret_hash)
  ) {
    if (required) {
      throw new CommentApiError('unauthorized', '匿名评论凭证无效', 401)
    }
    return null
  }
  await admin
    .from('resume_comment_anonymous_identities')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', anonymousId)
  return anonymousId
}

async function resolveAccess({
  req,
  body,
  admin,
  tokenSecret,
  collaboratorSecret,
  anonymousPepper,
}: {
  req: Request
  body: Record<string, unknown>
  admin: AdminClient
  tokenSecret: string
  collaboratorSecret: string
  anonymousPepper: string
}): Promise<ResolvedAccess> {
  const accessKind = readRequiredString(body, 'accessKind', 32)
  const userId = await authenticateUser(req, admin)

  if (accessKind === 'owner') {
    if (!userId) {
      throw new CommentApiError('unauthorized', '请先登录', 401)
    }
    let scopeId: string
    if (typeof body.scopeId === 'string') {
      scopeId = readUuid(body, 'scopeId')
    }
    else {
      const resumeId = readUuid(body, 'resumeId')
      const { data: resume, error } = await admin
        .from('resume_config')
        .select('resume_id,user_id,basics,job_intent,application_info,edu_background,work_experience,internship_experience,campus_experience,project_experience,skill_specialty,honors_certificates,self_evaluation,hobbies,order,visibility')
        .eq('resume_id', resumeId)
        .eq('user_id', userId)
        .maybeSingle()
      if (error || !resume) {
        throw new CommentApiError('not_found', '简历不存在', 404)
      }
      const projectionReferenceDate = new Date().toISOString().slice(0, 10)
      const projected = buildCommentAnchorDocument(resume, projectionReferenceDate)
      const { data, error: ensureError } = await admin.rpc(
        'ensure_resume_working_comment_scope',
        {
          p_owner_user_id: userId,
          p_resume_id: resumeId,
          p_anchor_document: projected.document,
          p_document_hash: projected.documentHash,
          p_projection_reference_date: projectionReferenceDate,
        },
      )
      if (ensureError || typeof data !== 'string') {
        throw ensureError ?? new Error('Unable to ensure working comment scope')
      }
      scopeId = data
    }
    const scope = await getScope(admin, scopeId)
    if (scope.owner_user_id !== userId) {
      throw new CommentApiError('not_found', '评论空间不存在', 404)
    }
    return {
      kind: 'owner',
      scope,
      userId,
      actorKind: 'user',
      actorId: userId,
      actorKey: `user:${userId}`,
      legacyAnonymousId: null,
      share: null,
      releaseId: scope.share_release_id,
      canWrite: true,
      canManageAll: true,
    }
  }

  if (accessKind === 'collaborator') {
    if (!userId) {
      throw new CommentApiError('unauthorized', '请先登录', 401)
    }
    const token = await verifyCommentToken(
      readRequiredString(body, 'accessToken', 4_096),
      'collaborator',
      collaboratorSecret,
    )
    const scope = await getScope(admin, token.scopeId)
    if (
      token.userId !== userId
      || scope.kind !== 'working'
      || scope.resume_id !== token.resumeId
    ) {
      throw new CommentApiError('unauthorized', '协作评论凭证无效', 401)
    }
    return {
      kind: 'collaborator',
      scope,
      userId,
      actorKind: 'user',
      actorId: userId,
      actorKey: `user:${userId}`,
      legacyAnonymousId: null,
      share: null,
      releaseId: null,
      canWrite: token.role === 'editor',
      canManageAll: false,
    }
  }

  if (accessKind !== 'share') {
    throw new CommentApiError('unauthorized', '评论访问方式无效', 401)
  }
  const token = await verifyCommentToken(
    readRequiredString(body, 'accessToken', 4_096),
    'share',
    tokenSecret,
  )
  const [scope, shareResult] = await Promise.all([
    getScope(admin, token.scopeId),
    admin
      .from('resume_shares')
      .select('id,user_id,current_release_id,allow_comments,is_active,archived_at,expires_at,password_hash')
      .eq('id', token.shareId)
      .maybeSingle(),
  ])
  const share = shareResult.data as ShareRow | null
  if (
    shareResult.error
    || !share
    || !share.is_active
    || share.archived_at
    || (share.expires_at && new Date(share.expires_at).getTime() <= Date.now())
  ) {
    throw new CommentApiError('share_unavailable', '分享已不可用', 404)
  }
  if (
    share.current_release_id !== token.releaseId
    || scope.share_release_id !== token.releaseId
  ) {
    throw new CommentApiError('stale_release', '分享已发布新版本，请刷新后重试', 409)
  }
  const passwordGeneration = await derivePasswordGeneration(share.password_hash, tokenSecret)
  if (passwordGeneration !== token.passwordGeneration) {
    throw new CommentApiError('share_unavailable', '分享访问状态已变化，请重新验证', 401)
  }

  let anonymousId: string | null = null
  try {
    anonymousId = await resolveAnonymousIdentity({
      admin,
      body,
      shareId: share.id,
      pepper: anonymousPepper,
      required: !userId && isRecord(body.anonymous),
    })
  }
  catch (error) {
    if (!userId) {
      throw error
    }
  }
  return {
    kind: 'share',
    scope,
    userId,
    actorKind: userId ? 'user' : anonymousId ? 'anonymous' : null,
    actorId: userId ?? anonymousId,
    actorKey: userId ? `user:${userId}` : anonymousId ? `anonymous:${anonymousId}` : null,
    legacyAnonymousId: userId ? anonymousId : null,
    share,
    releaseId: token.releaseId,
    canWrite: share.allow_comments,
    canManageAll: false,
  }
}

async function loadThreads(admin: AdminClient, scopeId: string) {
  const { data, error } = await admin
    .from('resume_comment_threads')
    .select(`
      id,
      scope_id,
      anchor,
      anchor_status,
      original_page_index,
      revision,
      resolved_at,
      resolved_by_kind,
      resolved_by_id,
      last_activity_at,
      created_at,
      updated_at,
      comments:resume_comments(
        id,
        thread_id,
        parent_id,
        author_kind,
        author_user_id,
        author_anonymous_id,
        body,
        edited_at,
        deleted_at,
        created_at,
        updated_at
      )
    `)
    .eq('scope_id', scopeId)
    .is('deleted_at', null)
    .order('last_activity_at', { ascending: false })
  if (error) {
    throw error
  }
  const threads = data ?? []
  const userIds = Array.from(new Set(threads.flatMap((thread) => {
    const comments = Array.isArray(thread.comments) ? thread.comments : []
    return comments.flatMap(comment => comment.author_user_id ? [comment.author_user_id] : [])
  })))
  const profiles = userIds.length > 0
    ? await admin.from('profiles').select('id,full_name,avatar_url').in('id', userIds)
    : { data: [], error: null }
  if (profiles.error) {
    throw profiles.error
  }
  return { threads, profiles: profiles.data ?? [] }
}

async function loadReadState(admin: AdminClient, access: ResolvedAccess) {
  if (!access.actorKind || !access.actorId) {
    return 0
  }
  let query = admin
    .from('resume_comment_read_states')
    .select('last_read_event_seq')
    .eq('scope_id', access.scope.id)
    .eq('principal_kind', access.actorKind)
  query = access.actorKind === 'user'
    ? query.eq('principal_user_id', access.actorId)
    : query.eq('principal_anonymous_id', access.actorId)
  const { data, error } = await query.maybeSingle()
  if (error) {
    throw error
  }
  return Number(data?.last_read_event_seq ?? 0)
}

async function issueTopics({
  access,
  realtimeSecret,
  tokenSecret,
}: {
  access: ResolvedAccess
  realtimeSecret: string
  tokenSecret: string
}) {
  const scopeTopic = await deriveScopeRealtimeTopic({
    scopeId: access.scope.id,
    releaseId: access.releaseId,
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

function requireActor(access: ResolvedAccess) {
  if (!access.actorKind || !access.actorId || !access.actorKey) {
    throw new CommentApiError('unauthorized', '请先登录或创建匿名身份', 401)
  }
}

function requireWrite(access: ResolvedAccess) {
  requireActor(access)
  if (!access.canWrite) {
    if (access.kind === 'share') {
      throw new CommentApiError('comments_disabled', '当前分享已关闭评论', 403)
    }
    throw new CommentApiError('unauthorized', '当前身份只有只读权限', 403)
  }
}

async function readReplay(
  admin: AdminClient,
  actorKey: string,
  requestId: string,
) {
  const { data, error } = await admin
    .from('resume_comment_requests')
    .select('response')
    .eq('actor_key', actorKey)
    .eq('request_id', requestId)
    .maybeSingle()
  if (error) {
    throw error
  }
  return data?.response ?? null
}

async function enforceRateLimit({
  req,
  admin,
  access,
  threadId,
  pepper,
}: {
  req: Request
  admin: AdminClient
  access: ResolvedAccess
  threadId: string | null
  pepper: string
}) {
  requireActor(access)
  const networkKey = await hashNetworkKey(getClientAddress(req), pepper)
  const { data, error } = await admin.rpc('check_resume_comment_rate_limit', {
    p_actor_key: access.actorKey,
    p_network_key: networkKey,
    p_share_id: access.share?.id ?? null,
    p_thread_id: threadId,
  })
  if (error) {
    throw error
  }
  const retryAfter = Number(data ?? 0)
  if (retryAfter > 0) {
    throw new CommentApiError(
      'rate_limited',
      '操作过于频繁，请稍后重试',
      429,
      retryAfter,
    )
  }
}

function mapDatabaseError(error: unknown): CommentApiError {
  if (error instanceof CommentApiError) {
    return error
  }
  const message = isRecord(error) && typeof error.message === 'string'
    ? error.message
    : ''
  const mappings: Array<[string, CommentApiError]> = [
    ['stale_release', new CommentApiError('stale_release', '分享已发布新版本，请刷新后重试', 409)],
    ['stale_document', new CommentApiError('stale_document', '简历内容已变化，请重新选择文字', 409)],
    ['stale_revision', new CommentApiError('stale_revision', '评论已被其他人更新，请刷新后重试', 409)],
    ['invalid_selection', new CommentApiError('invalid_selection', '评论选区已失效', 400)],
    ['unauthorized', new CommentApiError('unauthorized', '没有权限执行此操作', 403)],
    ['not_found', new CommentApiError('not_found', '目标不存在', 404)],
  ]
  return mappings.find(([needle]) => message.includes(needle))?.[1]
    ?? new CommentApiError('unexpected', '评论服务暂时不可用', 500)
}

function writePayload(body: Record<string, unknown>, access: ResolvedAccess) {
  const payload: Record<string, unknown> = {
    manageAll: access.canManageAll,
    legacyAnonymousId: access.legacyAnonymousId,
  }
  const copy = (field: string) => {
    if (body[field] !== undefined)
      payload[field] = body[field]
  }
  ;[
    'threadId',
    'commentId',
    'expectedRevision',
    'documentHash',
    'originalPageIndex',
    'eventSeq',
  ].forEach(copy)
  return payload
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: jsonHeaders })
  }
  if (req.method !== 'POST') {
    return failure(new CommentApiError('not_found', '接口不存在', 404))
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    return failure(new CommentApiError('unexpected', '评论服务暂时不可用', 500))
  }
  const tokenSecret = Deno.env.get('RESUME_COMMENT_TOKEN_SECRET') ?? serviceRoleKey
  const collaboratorSecret = Deno.env.get('RESUME_COMMENT_COLLABORATOR_SECRET') ?? tokenSecret
  const anonymousPepper = Deno.env.get('RESUME_COMMENT_ANONYMOUS_PEPPER') ?? tokenSecret
  const realtimeSecret = Deno.env.get('RESUME_COMMENT_REALTIME_SECRET') ?? tokenSecret
  const admin = createAdminClient(supabaseUrl, serviceRoleKey)

  try {
    const value = await req.json().catch(() => null)
    const op = readCommentOp(value)
    if (!isRecord(value)) {
      throw new CommentApiError('not_found', '请求无效', 400)
    }
    const body = value
    const access = await resolveAccess({
      req,
      body,
      admin,
      tokenSecret,
      collaboratorSecret,
      anonymousPepper,
    })

    if (op === 'create_anonymous_identity') {
      if (access.kind !== 'share' || access.userId) {
        throw new CommentApiError('unauthorized', '当前登录身份不使用匿名评论', 403)
      }
      if (!access.canWrite) {
        throw new CommentApiError('comments_disabled', '当前分享已关闭评论', 403)
      }
      const requestId = readRequestId(body)
      const secret = readRequiredString(body, 'anonymousSecret', 128)
      const secretHash = await hashAnonymousSecret(secret, anonymousPepper)
      const actorKey = `anonymous-new:${secretHash}`
      const replay = await readReplay(admin, actorKey, requestId)
      if (replay) {
        return success(replay, Number(replay.eventSeq ?? access.scope.next_event_seq))
      }
      const networkAccess: ResolvedAccess = {
        ...access,
        actorKind: 'anonymous',
        actorId: crypto.randomUUID(),
        actorKey,
      }
      await enforceRateLimit({
        req,
        admin,
        access: networkAccess,
        threadId: null,
        pepper: anonymousPepper,
      })
      const { data, error } = await admin.rpc('create_resume_comment_anonymous_identity', {
        p_share_id: access.share!.id,
        p_scope_id: access.scope.id,
        p_secret_hash: secretHash,
        p_actor_key: actorKey,
        p_request_id: requestId,
      })
      if (error) {
        throw error
      }
      return success(data, Number(data.eventSeq))
    }

    if (op === 'bootstrap_scope') {
      const [{ threads, profiles }, lastReadEventSeq, realtime] = await Promise.all([
        loadThreads(admin, access.scope.id),
        loadReadState(admin, access),
        issueTopics({ access, realtimeSecret, tokenSecret }),
      ])
      let accessibleScopes: unknown[] = []
      if (access.kind === 'owner' && access.userId) {
        const { data, error } = await admin
          .from('resume_comment_scopes')
          .select('id,kind,resume_id,history_version_id,share_release_id,document_revision,next_event_seq,updated_at')
          .eq('owner_user_id', access.userId)
          .order('updated_at', { ascending: false })
        if (error)
          throw error
        accessibleScopes = data ?? []
      }
      return success({
        scope: access.scope,
        threads,
        profiles,
        lastReadEventSeq,
        accessibleScopes,
        ...realtime,
      }, access.scope.next_event_seq)
    }

    if (op === 'list_threads') {
      const afterEventSeq = readNonNegativeInteger(body, 'afterEventSeq', 0)
      const [{ threads, profiles }, eventResult] = await Promise.all([
        loadThreads(admin, access.scope.id),
        admin
          .from('resume_comment_events')
          .select('event_seq,thread_id,type,actor_kind,actor_id,sanitized_payload,created_at')
          .eq('scope_id', access.scope.id)
          .gt('event_seq', afterEventSeq)
          .order('event_seq', { ascending: true })
          .limit(500),
      ])
      if (eventResult.error)
        throw eventResult.error
      const latestScope = await getScope(admin, access.scope.id)
      return success({ threads, profiles, events: eventResult.data ?? [] }, latestScope.next_event_seq)
    }

    if (op === 'issue_realtime_token') {
      const realtime = await issueTopics({ access, realtimeSecret, tokenSecret })
      return success(realtime, access.scope.next_event_seq)
    }

    if (op === 'sync_working_document') {
      if (access.kind !== 'owner' || !access.userId || access.scope.kind !== 'working') {
        throw new CommentApiError('unauthorized', '只有简历所有者可以同步评论文档', 403)
      }
      const requestId = readRequestId(body)
      const anchorDocument = body.anchorDocument
      const documentHash = readRequiredString(body, 'documentHash', 64)
      const projectionReferenceDate = readRequiredString(body, 'projectionReferenceDate', 10)
      const expectedDocumentRevision = readNonNegativeInteger(body, 'expectedDocumentRevision')
      if (
        !isRecord(anchorDocument)
        || !/^\d{4}-\d{2}-\d{2}$/u.test(projectionReferenceDate)
        || !/^[0-9a-f]{64}$/u.test(documentHash)
        || sha256Hex(stableStringify(anchorDocument)) !== documentHash
        || anchorDocument.projectionReferenceDate !== projectionReferenceDate
      ) {
        throw new CommentApiError('stale_document', '简历评论文档校验失败', 409)
      }
      const replay = await readReplay(admin, access.actorKey!, requestId)
      if (replay) {
        return success(replay, Number(replay.eventSeq))
      }
      await enforceRateLimit({
        req,
        admin,
        access,
        threadId: null,
        pepper: anonymousPepper,
      })
      const { data: threadRows, error: threadError } = await admin
        .from('resume_comment_threads')
        .select('id,anchor')
        .eq('scope_id', access.scope.id)
        .eq('anchor_status', 'anchored')
        .is('deleted_at', null)
        .is('resolved_at', null)
      if (threadError)
        throw threadError
      const nodeMap = new Map<string, CommentAnchorDocumentNode>(
        (Array.isArray(anchorDocument.nodes) ? anchorDocument.nodes : [])
          .filter(isRecord)
          .map(node => [
            String(node.nodeKey),
            node as unknown as CommentAnchorDocumentNode,
          ]),
      )
      const relocations: SyncRelocation[] = []
      for (const thread of threadRows ?? []) {
        const anchor = thread.anchor as ResumeCommentAnchor
        const result = relocateResumeCommentAnchor(
          anchor,
          nodeMap.get(anchor.nodeKey),
        )
        if (result.status === 'detached') {
          relocations.push({ threadId: thread.id, ...result })
          continue
        }
        if (!result.moved && !result.contextChanged) {
          continue
        }
        relocations.push({ threadId: thread.id, ...result })
      }
      const { data, error } = await admin.rpc('sync_resume_working_comment_document_v2', {
        p_scope_id: access.scope.id,
        p_owner_user_id: access.userId,
        p_anchor_document: anchorDocument,
        p_document_hash: documentHash,
        p_expected_document_revision: expectedDocumentRevision,
        p_projection_reference_date: projectionReferenceDate,
        p_relocations: relocations,
        p_actor_key: access.actorKey,
        p_request_id: requestId,
      })
      if (error)
        throw error
      await notifyWrite({ admin, access, realtimeSecret, eventSeq: Number(data.eventSeq), type: op })
      return success(data, Number(data.eventSeq))
    }

    requireActor(access)
    const requestId = readRequestId(body)
    if (access.kind === 'share') {
      const expectedReleaseId = readUuid(body, 'releaseId')
      if (expectedReleaseId !== access.releaseId) {
        throw new CommentApiError('stale_release', '分享已发布新版本，请刷新后重试', 409)
      }
    }
    const replay = await readReplay(admin, access.actorKey!, requestId)
    if (replay) {
      return success(replay, Number(replay.eventSeq))
    }

    const payload = writePayload(body, access)
    if (['create_thread', 'relink_anchor'].includes(op)) {
      payload.anchor = readCommentAnchor(body.anchor)
      payload.documentHash = readRequiredString(body, 'documentHash', 64)
    }
    if (['create_thread', 'create_reply', 'edit_comment'].includes(op)) {
      payload.body = normalizeCommentBody(body.body)
    }
    if (op !== 'mark_read') {
      requireWrite(access)
    }
    if (op === 'delete_thread' && !access.canManageAll) {
      throw new CommentApiError('unauthorized', '只有简历所有者可以删除整条线程', 403)
    }
    if (
      ['create_reply', 'edit_comment', 'delete_comment', 'delete_thread', 'resolve_thread', 'reopen_thread', 'relink_anchor'].includes(op)
    ) {
      payload.threadId = readUuid(body, 'threadId')
      payload.expectedRevision = readNonNegativeInteger(body, 'expectedRevision')
    }
    if (['edit_comment', 'delete_comment'].includes(op)) {
      payload.commentId = readUuid(body, 'commentId')
    }
    if (op === 'mark_read') {
      payload.eventSeq = readNonNegativeInteger(body, 'eventSeq')
    }

    if (op !== 'mark_read') {
      await enforceRateLimit({
        req,
        admin,
        access,
        threadId: typeof payload.threadId === 'string' ? payload.threadId : null,
        pepper: anonymousPepper,
      })
    }
    const { data, error } = await admin.rpc('execute_resume_comment_write', {
      p_op: op,
      p_scope_id: access.scope.id,
      p_actor_kind: access.actorKind,
      p_actor_id: access.actorId,
      p_actor_key: access.actorKey,
      p_request_id: requestId,
      p_payload: payload,
    })
    if (error)
      throw error
    const eventSeq = Number(data.eventSeq)
    if (op !== 'mark_read') {
      await notifyWrite({ admin, access, realtimeSecret, eventSeq, type: op })
    }
    return success(data, eventSeq)
  }
  catch (error) {
    const mapped = mapDatabaseError(error)
    if (mapped.code === 'unexpected') {
      console.error('resume-comments failed', {
        message: error instanceof Error ? error.message : 'unknown',
      })
    }
    return failure(mapped)
  }
})

async function notifyWrite({
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
  const topics = [await deriveScopeRealtimeTopic({
    scopeId: access.scope.id,
    releaseId: access.releaseId,
    secret: realtimeSecret,
  })]
  topics.push(await deriveOwnerRealtimeTopic({
    userId: access.scope.owner_user_id,
    secret: realtimeSecret,
  }))
  await broadcastCommentInvalidation({
    admin,
    topics: topics.map(item => item.topic),
    eventSeq,
    type,
  })
}
