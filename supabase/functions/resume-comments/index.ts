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
  signCommentToken,
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
  'Access-Control-Expose-Headers': 'Server-Timing, X-Request-Id',
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
  kind: 'working' | 'history' | 'share_release' | 'version'
  owner_user_id: string
  resume_id: string
  version_id: number | null
  history_version_id: number | null
  share_release_id: string | null
  anchor_document: {
    nodes?: Array<{ nodeKey: string, text: string, blocks: unknown[], nodeTextHash: string }>
  }
  document_hash: string
  document_revision: number
  projection_reference_date: string
  next_event_seq: number
  archived_at: string | null
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
  version_id: number
}

interface CollaborationSessionRow {
  session_id: string
  resume_id: string
  scope_id: string
  owner_user_id: string
  host_lease_id: string
  default_role: 'editor' | 'viewer'
  expires_at: string
  revoked_at: string | null
}

interface CollaborationMemberRow {
  session_id: string
  user_id: string
  role: 'editor' | 'viewer'
  expires_at: string
  revoked_at: string | null
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
  versionId: number
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

function scheduleBackground(task: Promise<unknown>) {
  const edgeRuntime = (globalThis as typeof globalThis & {
    EdgeRuntime?: { waitUntil: (promise: Promise<unknown>) => void }
  }).EdgeRuntime
  const guardedTask = task.catch((error) => {
    console.error('resume-comment-background-task-failed', {
      message: error instanceof Error ? error.message : 'unknown',
    })
  })
  if (edgeRuntime?.waitUntil) {
    edgeRuntime.waitUntil(guardedTask)
    return
  }
  guardedTask.catch(() => undefined)
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
    .select('id,kind,owner_user_id,resume_id,version_id,history_version_id,share_release_id,anchor_document,document_hash,document_revision,projection_reference_date,next_event_seq,archived_at')
    .eq('id', scopeId)
    .maybeSingle()
  if (error || !data) {
    throw new CommentApiError('not_found', '评论空间不存在', 404)
  }
  return data as ScopeRow
}

function readCollaborationSessionId(body: Record<string, unknown>) {
  const sessionId = readRequiredString(body, 'sessionId', 64)
  if (!/^[\w-]{16,64}$/u.test(sessionId)) {
    throw new CommentApiError('not_found', '协作会话标识无效', 400)
  }
  return sessionId
}

function isFutureTimestamp(value: string) {
  return Number.isFinite(Date.parse(value)) && Date.parse(value) > Date.now()
}

async function ensureVersionScopeForOwner(
  admin: AdminClient,
  ownerUserId: string,
  versionId: number,
) {
  const { data: existing, error: existingError } = await admin
    .from('resume_comment_scopes')
    .select('id,kind,owner_user_id,resume_id,version_id,history_version_id,share_release_id,anchor_document,document_hash,document_revision,projection_reference_date,next_event_seq,archived_at')
    .eq('kind', 'version')
    .eq('version_id', versionId)
    .eq('owner_user_id', ownerUserId)
    .is('archived_at', null)
    .maybeSingle()
  if (existingError)
    throw existingError
  if (existing?.id)
    return existing as ScopeRow

  const { data: version, error } = await admin
    .from('resume_config_versions')
    .select('id,resume_id,user_id,snapshot,projection_reference_date,document_revision')
    .eq('id', versionId)
    .eq('user_id', ownerUserId)
    .maybeSingle()
  if (error || !version) {
    throw new CommentApiError('not_found', '简历版本不存在', 404)
  }
  const projectionReferenceDate = String(version.projection_reference_date)
  const projected = buildCommentAnchorDocument(version.snapshot, projectionReferenceDate)
  const { data, error: ensureError } = await admin.rpc(
    'ensure_resume_version_comment_scope',
    {
      p_owner_user_id: ownerUserId,
      p_version_id: version.id,
      p_anchor_document: projected.document,
      p_document_hash: projected.documentHash,
      p_projection_reference_date: projectionReferenceDate,
    },
  )
  if (ensureError || typeof data !== 'string')
    throw ensureError ?? new Error('Unable to ensure version comment scope')
  return getScope(admin, data)
}

async function resolveCurrentVersionId(
  admin: AdminClient,
  ownerUserId: string,
  resumeId: string,
) {
  const { data, error } = await admin
    .from('resume_config')
    .select('current_version_id')
    .eq('resume_id', resumeId)
    .eq('user_id', ownerUserId)
    .maybeSingle()
  const versionId = Number(data?.current_version_id)
  if (error || !Number.isSafeInteger(versionId) || versionId <= 0)
    throw new CommentApiError('not_found', '简历当前版本不存在', 404)
  return versionId
}

async function loadPersistedResumeSnapshot(
  admin: AdminClient,
  ownerUserId: string,
  resumeId: string,
) {
  const { data, error } = await admin
    .from('resume_config')
    .select('type,basics,job_intent,application_info,edu_background,work_experience,internship_experience,campus_experience,project_experience,skill_specialty,honors_certificates,self_evaluation,hobbies,order,visibility,spacing,font,theme,template_binding')
    .eq('resume_id', resumeId)
    .eq('user_id', ownerUserId)
    .maybeSingle()
  if (error || !data)
    throw new CommentApiError('not_found', '简历不存在', 404)
  return data
}

async function getActiveCollaborationSession(
  admin: AdminClient,
  sessionId: string,
  resumeId: string,
) {
  const { data, error } = await admin
    .from('resume_comment_collaboration_sessions')
    .select('session_id,resume_id,scope_id,owner_user_id,host_lease_id,default_role,expires_at,revoked_at')
    .eq('session_id', sessionId)
    .eq('resume_id', resumeId)
    .maybeSingle()
  const session = data as CollaborationSessionRow | null
  if (error || !session || session.revoked_at || !isFutureTimestamp(session.expires_at)) {
    throw new CommentApiError('unauthorized', '协作会话已结束或不存在', 401)
  }
  return session
}

async function issueCollaboratorToken({
  session,
  member,
  versionId,
  collaboratorSecret,
}: {
  session: CollaborationSessionRow
  member: CollaborationMemberRow
  versionId: number
  collaboratorSecret: string
}) {
  const issuedAt = Math.floor(Date.now() / 1_000)
  const sessionExpiresAt = Math.floor(Date.parse(session.expires_at) / 1_000)
  const memberExpiresAt = Math.floor(Date.parse(member.expires_at) / 1_000)
  const expiresAt = Math.min(issuedAt + 15 * 60, sessionExpiresAt, memberExpiresAt)
  if (expiresAt <= issuedAt) {
    throw new CommentApiError('unauthorized', '协作会话已失效', 401)
  }
  return {
    accessToken: await signCommentToken({
      version: 1,
      kind: 'collaborator',
      issuedAt,
      expiresAt,
      sessionId: session.session_id,
      resumeId: session.resume_id,
      scopeId: session.scope_id,
      versionId,
      userId: member.user_id,
      role: member.role,
    }, collaboratorSecret),
    expiresAt: new Date(expiresAt * 1_000).toISOString(),
    sessionId: session.session_id,
    resumeId: session.resume_id,
    versionId,
    userId: member.user_id,
    role: member.role,
  }
}

async function handleCollaborationSessionOperation({
  op,
  userId,
  body,
  admin,
  collaboratorSecret,
}: {
  op: 'register_collaboration_session' | 'join_collaboration_session' | 'renew_collaboration_session' | 'leave_collaboration_session'
  userId: string | null
  body: Record<string, unknown>
  admin: AdminClient
  collaboratorSecret: string
}) {
  if (!userId) {
    throw new CommentApiError('unauthorized', '请先登录', 401)
  }
  const sessionId = readCollaborationSessionId(body)
  const resumeId = readUuid(body, 'resumeId')

  if (op === 'register_collaboration_session') {
    const versionId = await resolveCurrentVersionId(admin, userId, resumeId)
    const scope = await ensureVersionScopeForOwner(admin, userId, versionId)
    const { data: existing, error: existingError } = await admin
      .from('resume_comment_collaboration_sessions')
      .select('session_id,resume_id,owner_user_id,default_role,revoked_at')
      .eq('session_id', sessionId)
      .maybeSingle()
    if (existingError) {
      throw existingError
    }
    if (existing && (existing.resume_id !== resumeId || existing.owner_user_id !== userId)) {
      throw new CommentApiError('unauthorized', '协作会话标识已被占用', 403)
    }
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1_000).toISOString()
    const hostLeaseId = crypto.randomUUID()
    const { error } = await admin
      .from('resume_comment_collaboration_sessions')
      .upsert({
        session_id: sessionId,
        resume_id: resumeId,
        scope_id: scope.id,
        owner_user_id: userId,
        host_lease_id: hostLeaseId,
        // 角色只读取服务端已有配置；首次会话默认编辑者，绝不接收客户端角色字段。
        default_role: existing?.default_role === 'viewer' ? 'viewer' : 'editor',
        expires_at: expiresAt,
        revoked_at: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'session_id' })
    if (error) {
      throw error
    }
    if (existing?.revoked_at) {
      const { error: revokeError } = await admin
        .from('resume_comment_collaboration_members')
        .update({ revoked_at: new Date().toISOString() })
        .eq('session_id', sessionId)
        .is('revoked_at', null)
      if (revokeError) {
        throw revokeError
      }
    }
    else {
      const { error: extendError } = await admin
        .from('resume_comment_collaboration_members')
        .update({ expires_at: expiresAt })
        .eq('session_id', sessionId)
        .is('revoked_at', null)
      if (extendError) {
        throw extendError
      }
    }
    return { sessionId, resumeId, expiresAt, hostLeaseId }
  }

  const session = await getActiveCollaborationSession(admin, sessionId, resumeId)
  if (op === 'leave_collaboration_session') {
    const revokedAt = new Date().toISOString()
    if (session.owner_user_id === userId) {
      const hostLeaseId = readUuid(body, 'hostLeaseId')
      const sessionResult = await admin
        .from('resume_comment_collaboration_sessions')
        .update({ revoked_at: revokedAt, updated_at: revokedAt })
        .eq('session_id', sessionId)
        .eq('owner_user_id', userId)
        .eq('host_lease_id', hostLeaseId)
        .select('session_id')
        .maybeSingle()
      if (sessionResult.error) {
        throw sessionResult.error
      }
      if (!sessionResult.data) {
        return { sessionId, revoked: false }
      }
      const membersResult = await admin
        .from('resume_comment_collaboration_members')
        .update({ revoked_at: revokedAt })
        .eq('session_id', sessionId)
        .is('revoked_at', null)
      if (membersResult.error) {
        throw membersResult.error
      }
    }
    else {
      const { error } = await admin
        .from('resume_comment_collaboration_members')
        .update({ revoked_at: revokedAt })
        .eq('session_id', sessionId)
        .eq('user_id', userId)
      if (error) {
        throw error
      }
    }
    return { sessionId, revoked: true }
  }

  let member: CollaborationMemberRow | null = null
  if (op === 'join_collaboration_session') {
    if (session.owner_user_id === userId) {
      throw new CommentApiError('unauthorized', '简历所有者无需以协作者身份加入', 403)
    }
    const { data, error } = await admin
      .from('resume_comment_collaboration_members')
      .upsert({
        session_id: sessionId,
        user_id: userId,
        role: session.default_role,
        expires_at: session.expires_at,
        revoked_at: null,
        last_seen_at: new Date().toISOString(),
      }, { onConflict: 'session_id,user_id' })
      .select('session_id,user_id,role,expires_at,revoked_at')
      .single()
    if (error || !data) {
      throw error ?? new Error('Unable to join collaboration comment session')
    }
    member = data as CollaborationMemberRow
  }
  else {
    const { data, error } = await admin
      .from('resume_comment_collaboration_members')
      .select('session_id,user_id,role,expires_at,revoked_at')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .maybeSingle()
    member = data as CollaborationMemberRow | null
    if (
      error
      || !member
      || member.revoked_at
      || !isFutureTimestamp(member.expires_at)
    ) {
      throw new CommentApiError('unauthorized', '协作者评论权限已失效', 401)
    }
    const { error: touchError } = await admin
      .from('resume_comment_collaboration_members')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('session_id', sessionId)
      .eq('user_id', userId)
    if (touchError) {
      throw touchError
    }
  }
  if (!member) {
    throw new CommentApiError('unauthorized', '协作者评论权限不存在', 401)
  }
  const scope = await getScope(admin, session.scope_id)
  if (scope.kind !== 'version' || scope.version_id == null)
    throw new CommentApiError('unauthorized', '协作评论版本无效', 401)
  return issueCollaboratorToken({
    session,
    member,
    versionId: scope.version_id,
    collaboratorSecret,
  })
}

async function resolveAnonymousIdentity({
  admin,
  body,
  versionId,
  pepper,
  required,
}: {
  admin: AdminClient
  body: Record<string, unknown>
  versionId: number
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
    .select('id,version_id,secret_hash,revoked_at')
    .eq('id', anonymousId)
    .maybeSingle()
  if (
    error
    || !data
    || Number(data.version_id) !== versionId
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
  userId,
  body,
  admin,
  tokenSecret,
  collaboratorSecret,
  anonymousPepper,
}: {
  userId: string | null
  body: Record<string, unknown>
  admin: AdminClient
  tokenSecret: string
  collaboratorSecret: string
  anonymousPepper: string
}): Promise<ResolvedAccess> {
  const accessKind = readRequiredString(body, 'accessKind', 32)

  if (accessKind === 'owner') {
    if (!userId) {
      throw new CommentApiError('unauthorized', '请先登录', 401)
    }
    let scope: ScopeRow
    if (typeof body.scopeId === 'string') {
      scope = await getScope(admin, readUuid(body, 'scopeId'))
    }
    else if (body.versionId !== undefined || body.historyVersionId !== undefined) {
      const versionId = readNonNegativeInteger(
        body,
        body.versionId !== undefined ? 'versionId' : 'historyVersionId',
      )
      if (versionId <= 0)
        throw new CommentApiError('not_found', '简历版本不存在', 404)
      scope = await ensureVersionScopeForOwner(admin, userId, versionId)
    }
    else if (typeof body.shareReleaseId === 'string') {
      const shareReleaseId = readUuid(body, 'shareReleaseId')
      const { data: release, error: releaseError } = await admin
        .from('resume_share_releases')
        .select('id,share_id')
        .eq('id', shareReleaseId)
        .maybeSingle()
      if (releaseError || !release) {
        throw new CommentApiError('not_found', '分享反馈不存在', 404)
      }
      const { data: share, error: shareError } = await admin
        .from('resume_shares')
        .select('id,user_id,version_id')
        .eq('id', release.share_id)
        .eq('user_id', userId)
        .maybeSingle()
      if (shareError || !share) {
        throw new CommentApiError('not_found', '分享反馈不存在', 404)
      }
      const versionId = Number(share.version_id)
      if (!Number.isSafeInteger(versionId) || versionId <= 0)
        throw new CommentApiError('not_found', '分享版本不存在', 404)
      scope = await ensureVersionScopeForOwner(admin, userId, versionId)
    }
    else {
      const resumeId = readUuid(body, 'resumeId')
      const versionId = await resolveCurrentVersionId(admin, userId, resumeId)
      scope = await ensureVersionScopeForOwner(admin, userId, versionId)
    }
    if (scope.owner_user_id !== userId || scope.kind !== 'version' || scope.version_id == null) {
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
      releaseId: null,
      versionId: scope.version_id,
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
    const [scope, sessionResult, memberResult] = await Promise.all([
      getScope(admin, token.scopeId),
      admin
        .from('resume_comment_collaboration_sessions')
        .select('session_id,resume_id,scope_id,owner_user_id,host_lease_id,default_role,expires_at,revoked_at')
        .eq('session_id', token.sessionId)
        .maybeSingle(),
      admin
        .from('resume_comment_collaboration_members')
        .select('session_id,user_id,role,expires_at,revoked_at')
        .eq('session_id', token.sessionId)
        .eq('user_id', userId)
        .maybeSingle(),
    ])
    const session = sessionResult.data as CollaborationSessionRow | null
    const member = memberResult.data as CollaborationMemberRow | null
    if (
      sessionResult.error
      || memberResult.error
      || !session
      || !member
      || token.userId !== userId
      || token.sessionId !== session.session_id
      || token.resumeId !== session.resume_id
      || token.scopeId !== session.scope_id
      || token.versionId !== scope.version_id
      || token.role !== member.role
      || member.user_id !== userId
      || member.revoked_at
      || session.revoked_at
      || !isFutureTimestamp(member.expires_at)
      || !isFutureTimestamp(session.expires_at)
      || scope.kind !== 'version'
      || scope.version_id == null
      || scope.resume_id !== token.resumeId
      || scope.owner_user_id !== session.owner_user_id
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
      versionId: scope.version_id,
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
      .select('id,user_id,version_id,current_release_id,allow_comments,is_active,archived_at,expires_at,password_hash')
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
    share.version_id !== token.versionId
    || scope.version_id !== token.versionId
    || scope.kind !== 'version'
    || scope.archived_at
    || share.current_release_id !== token.releaseId
  ) {
    throw new CommentApiError('stale_release', '分享版本已变化，请刷新后重试', 409)
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
      versionId: token.versionId,
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
    versionId: token.versionId,
    canWrite: share.allow_comments,
    canManageAll: false,
  }
}

async function loadThreads(
  admin: AdminClient,
  scopeId: string,
  threadIds?: string[],
) {
  let query = admin
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
  if (threadIds)
    query = threadIds.length > 0 ? query.in('id', threadIds) : query.in('id', ['00000000-0000-0000-0000-000000000000'])
  const { data, error } = await query.order('last_activity_at', { ascending: false })
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

async function loadThreadCounts(admin: AdminClient, scopeId: string) {
  const { data, error } = await admin
    .from('resume_comment_threads')
    .select('anchor_status,resolved_at')
    .eq('scope_id', scopeId)
    .is('deleted_at', null)
  if (error)
    throw error
  return countThreadRows(data ?? [])
}

function countThreadRows(threads: Array<{ anchor_status: string, resolved_at: string | null }>) {
  return threads.reduce((counts, thread) => {
    if (thread.anchor_status === 'detached')
      counts.detached += 1
    else if (thread.resolved_at)
      counts.resolved += 1
    else
      counts.unresolved += 1
    return counts
  }, { unresolved: 0, resolved: 0, detached: 0 })
}

async function loadVersionReference(admin: AdminClient, versionId: number) {
  const [versionResult, shareCountResult] = await Promise.all([
    admin
      .from('resume_config_versions')
      .select('id,version_no,version_name,milestone_name,status,content_hash,document_revision,projection_reference_date')
      .eq('id', versionId)
      .single(),
    admin
      .from('resume_shares')
      .select('id', { count: 'exact', head: true })
      .eq('version_id', versionId)
      .is('archived_at', null),
  ])
  if (versionResult.error)
    throw versionResult.error
  if (shareCountResult.error)
    throw shareCountResult.error
  return {
    ...versionResult.data,
    shared_link_count: shareCountResult.count ?? 0,
  }
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
    'parentCommentId',
    'expectedRevision',
    'documentHash',
    'originalPageIndex',
    'eventSeq',
  ].forEach(copy)
  return payload
}

Deno.serve(async (req) => {
  const requestStartedAt = performance.now()
  const requestId = /^[0-9a-f-]{36}$/iu.test(req.headers.get('x-request-id') ?? '')
    ? req.headers.get('x-request-id')!
    : crypto.randomUUID()
  let authDuration = 0
  let accessDuration = 0
  const operationDurations: Record<string, number> = {}
  const timeOperation = async <T>(name: string, operation: () => Promise<T>) => {
    const startedAt = performance.now()
    try {
      return await operation()
    }
    finally {
      operationDurations[name] = performance.now() - startedAt
    }
  }
  const finalize = (response: Response) => {
    const totalDuration = performance.now() - requestStartedAt
    const dbDuration = Math.max(0, totalDuration - authDuration - accessDuration)
    response.headers.set('X-Request-Id', requestId)
    response.headers.set(
      'Server-Timing',
      [
        `auth;dur=${authDuration.toFixed(1)}`,
        `access;dur=${accessDuration.toFixed(1)}`,
        `db;dur=${dbDuration.toFixed(1)}`,
        ...Object.entries(operationDurations).map(([name, duration]) => (
          `${name};dur=${duration.toFixed(1)}`
        )),
        'broadcast;desc="scheduled after commit"',
        `total;dur=${totalDuration.toFixed(1)}`,
      ].join(', '),
    )
    return response
  }
  if (req.method === 'OPTIONS') {
    return finalize(new Response('ok', { headers: jsonHeaders }))
  }
  if (req.method !== 'POST') {
    return finalize(failure(new CommentApiError('not_found', '接口不存在', 404)))
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    return finalize(failure(new CommentApiError('unexpected', '评论服务暂时不可用', 500)))
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
    const authStartedAt = performance.now()
    const userId = await authenticateUser(req, admin)
    authDuration = performance.now() - authStartedAt
    if (
      op === 'register_collaboration_session'
      || op === 'join_collaboration_session'
      || op === 'renew_collaboration_session'
      || op === 'leave_collaboration_session'
    ) {
      const data = await handleCollaborationSessionOperation({
        op,
        userId,
        body,
        admin,
        collaboratorSecret,
      })
      return finalize(success(data, 0))
    }
    const accessStartedAt = performance.now()
    const access = await resolveAccess({
      userId,
      body,
      admin,
      tokenSecret,
      collaboratorSecret,
      anonymousPepper,
    })
    accessDuration = performance.now() - accessStartedAt

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
        return finalize(success(replay, Number(replay.eventSeq ?? access.scope.next_event_seq)))
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
      const { data, error } = await admin.rpc('create_resume_comment_anonymous_identity_v2', {
        p_share_id: access.share!.id,
        p_version_id: access.versionId,
        p_scope_id: access.scope.id,
        p_secret_hash: secretHash,
        p_actor_key: actorKey,
        p_request_id: requestId,
      })
      if (error) {
        throw error
      }
      return finalize(success(data, Number(data.eventSeq)))
    }

    if (op === 'bootstrap_scope') {
      const [{ threads, profiles }, lastReadEventSeq, realtime, version] = await Promise.all([
        timeOperation('threads', () => loadThreads(admin, access.scope.id)),
        timeOperation('read_state', () => loadReadState(admin, access)),
        timeOperation('realtime_token', () => issueTopics({ access, realtimeSecret, tokenSecret })),
        timeOperation('version', () => loadVersionReference(admin, access.versionId)),
      ])
      const counts = countThreadRows(threads)
      return finalize(success({
        scope: access.scope,
        version,
        counts,
        threads,
        profiles,
        lastReadEventSeq,
        accessibleScopes: [{
          ...access.scope,
          last_read_event_seq: lastReadEventSeq,
        }],
        ...realtime,
      }, access.scope.next_event_seq))
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
      return finalize(success({ threads, profiles, events: eventResult.data ?? [] }, latestScope.next_event_seq))
    }

    if (op === 'list_events') {
      const afterEventSeq = readNonNegativeInteger(body, 'afterEventSeq', 0)
      const eventResult = await admin
        .from('resume_comment_events')
        .select('id,event_seq,thread_id,type,actor_kind,actor_id,sanitized_payload,created_at')
        .eq('scope_id', access.scope.id)
        .gt('event_seq', afterEventSeq)
        .order('event_seq', { ascending: true })
        .limit(500)
      if (eventResult.error)
        throw eventResult.error
      const events = eventResult.data ?? []
      const threadIds = Array.from(new Set(events.flatMap(event => event.thread_id ? [event.thread_id] : [])))
      const [{ threads, profiles }, latestScope] = await Promise.all([
        loadThreads(admin, access.scope.id, threadIds),
        getScope(admin, access.scope.id),
      ])
      return finalize(success({ threads, profiles, events }, latestScope.next_event_seq))
    }

    if (op === 'issue_realtime_token') {
      const realtime = await issueTopics({ access, realtimeSecret, tokenSecret })
      return finalize(success(realtime, access.scope.next_event_seq))
    }

    if (op === 'sync_working_document') {
      if (
        access.kind !== 'owner'
        || !access.userId
        || access.scope.kind !== 'version'
        || access.scope.version_id == null
      ) {
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
        return finalize(success(replay, Number(replay.eventSeq)))
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
          documentHash,
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
      const snapshot = await loadPersistedResumeSnapshot(
        admin,
        access.userId,
        access.scope.resume_id,
      )
      const { data, error } = await admin.rpc('sync_resume_version_comment_document_v3', {
        p_scope_id: access.scope.id,
        p_version_id: access.versionId,
        p_owner_user_id: access.userId,
        p_snapshot: snapshot,
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
      scheduleBackground(notifyWrite({
        admin,
        access,
        realtimeSecret,
        eventSeq: Number(data.eventSeq),
        type: op,
      }))
      const eventSeq = Number(data.eventSeq)
      const [{ threads, profiles }, counts] = await Promise.all([
        loadThreads(
          admin,
          access.scope.id,
          relocations.map(relocation => relocation.threadId),
        ),
        loadThreadCounts(admin, access.scope.id),
      ])
      return finalize(success({
        ...data,
        threads,
        profiles,
        counts,
        event: {
          event_seq: eventSeq,
          thread_id: null,
          type: 'document_synced',
          created_at: new Date().toISOString(),
        },
      }, eventSeq))
    }

    requireActor(access)
    const requestId = readRequestId(body)
    if (access.kind === 'share') {
      const expectedReleaseId = readUuid(body, 'releaseId')
      const expectedVersionId = readNonNegativeInteger(body, 'versionId')
      if (
        expectedReleaseId !== access.releaseId
        || expectedVersionId !== access.versionId
      ) {
        throw new CommentApiError('stale_release', '分享已发布新版本，请刷新后重试', 409)
      }
    }
    const replay = await readReplay(admin, access.actorKey!, requestId)
    if (replay) {
      return finalize(success(replay, Number(replay.eventSeq)))
    }

    const payload = writePayload(body, access)
    if (['create_thread', 'relink_anchor'].includes(op)) {
      payload.anchor = readCommentAnchor(body.anchor)
      payload.documentHash = readRequiredString(body, 'documentHash', 64)
    }
    if (['create_thread', 'create_reply', 'edit_comment'].includes(op)) {
      payload.body = normalizeCommentBody(body.body)
    }
    if (op === 'create_reply') {
      payload.parentCommentId = readUuid(body, 'parentCommentId')
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
    const { data, error } = await admin.rpc('execute_resume_version_comment_write', {
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
      scheduleBackground(notifyWrite({
        admin,
        access,
        realtimeSecret,
        eventSeq,
        type: op,
      }))
    }
    if (op === 'mark_read')
      return finalize(success(data, eventSeq))
    const threadId = typeof data.threadId === 'string' ? data.threadId : null
    const [{ threads, profiles }, counts] = await Promise.all([
      threadId
        ? loadThreads(admin, access.scope.id, [threadId])
        : Promise.resolve({ threads: [], profiles: [] }),
      loadThreadCounts(admin, access.scope.id),
    ])
    const thread = threads[0] ?? null
    const comments = thread && Array.isArray(thread.comments) ? thread.comments : []
    const commentId = typeof data.commentId === 'string' ? data.commentId : null
    return finalize(success({
      ...data,
      thread,
      comment: commentId
        ? comments.find(comment => comment.id === commentId) ?? null
        : null,
      removedCommentId: op === 'delete_comment' ? commentId : null,
      profiles,
      counts,
      event: {
        event_seq: eventSeq,
        thread_id: threadId,
        type: op,
        created_at: new Date().toISOString(),
      },
    }, eventSeq))
  }
  catch (error) {
    const mapped = mapDatabaseError(error)
    if (mapped.code === 'unexpected') {
      console.error('resume-comments failed', {
        requestId,
        message: error instanceof Error ? error.message : 'unknown',
      })
    }
    return finalize(failure(mapped))
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
    versionId: access.versionId,
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
