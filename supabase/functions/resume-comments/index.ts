/* global Deno */

import type {
  CommentAnchorDocumentNode,
  ResumeCommentAnchor,
  ResumeCommentRelocationResult,
} from '../shared/resume-comment-core.ts'
import type { CommentApiOp } from '../shared/resume-comment-schema.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.103.0'
import { corsPreflightResponse, isOriginAllowed } from '../shared/cors.ts'
import { recordOperationMetric, scheduleBackground } from '../shared/operation-metrics.ts'
import { createRequestContext } from '../shared/request-context.ts'
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
import {
  authenticateSupabaseUser,
  SupabaseAuthenticationError,
} from '../shared/supabase-auth.ts'

function createAdminClient(url: string, serviceRoleKey: string) {
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

type AdminClient = ReturnType<typeof createAdminClient>
type ActorKind = 'user' | 'anonymous'
type AccessKind = 'owner' | 'collaborator' | 'share'
type SyncRelocation = ResumeCommentRelocationResult & { threadId: string }

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
const COLLABORATION_SESSION_PATTERN = /^[\w-]{16,64}$/u

let nextRequestIsColdStart = true

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
  protocol_version: 1 | 2
}

interface CollaborationDocumentRow {
  document_data: string
  heads: string[]
  document_version: number
  updated_at: string
}

interface CollaborationMemberRow {
  session_id: string
  user_id: string
  member_lease_id: string
  role: 'editor' | 'viewer'
  expires_at: string
  revoked_at: string | null
  protocol_version: 1 | 2
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

function resolveCommentEventType(op: CommentApiOp) {
  return COMMENT_EVENT_TYPE_BY_OP[op] ?? op
}

function projectCommentEventsForAccess(events: unknown[], access: ResolvedAccess) {
  return events.flatMap((value) => {
    if (!isRecord(value))
      return []
    return [{
      event_seq: value.event_seq,
      thread_id: value.thread_id,
      type: value.type,
      sanitized_payload: value.sanitized_payload,
      created_at: value.created_at,
      is_own: Boolean(
        access.actorKind
        && access.actorId
        && value.actor_kind === access.actorKind
        && value.actor_id === access.actorId,
      ),
    }]
  })
}

interface BootstrapRpcInput {
  p_protocol_version: 1
  p_access_kind: AccessKind
  p_user_id: string | null
  p_scope_id: string | null
  p_resume_id: string | null
  p_version_id: number | null
  p_share_id: string | null
  p_release_id: string | null
  p_password_generation: string | null
  p_session_id: string | null
  p_collaborator_role: 'editor' | 'viewer' | null
  p_anonymous_id: string | null
  p_anonymous_secret_hash: string | null
}

interface BootstrapInputContext {
  rpcInput: BootstrapRpcInput
  shareTokenSecret: string | null
  collaboratorLease: {
    protocolVersion: 1 | 2
    sessionId: string
    resumeId: string
    userId: string
    memberLeaseId: string | null
  } | null
}

interface BootstrapAccessEnvelope {
  kind: AccessKind
  userId: string | null
  actorKind: ActorKind | null
  actorId: string | null
  actorKey: string | null
  legacyAnonymousId: string | null
  canWrite: boolean
  canManageAll: boolean
  scopeId: string
  versionId: number
  ownerUserId: string
  shareId: string | null
  releaseId: string | null
  sharePasswordHash: string | null
}

interface BootstrapScope {
  id: string
  kind: 'version'
  owner_user_id: string
  resume_id: string
  version_id: number
  history_version_id: null
  share_release_id: null
  anchor_document: {
    nodes: Array<{ nodeKey: string }>
  }
  document_hash: string
  document_revision: number
  projection_reference_date: string
  next_event_seq: number
  archived_at: null
}

interface BootstrapVersion {
  id: number
  version_no: number
  version_name: string | null
  milestone_name: string | null
  status: 'active' | 'frozen'
  content_hash: string | null
  document_revision: number
  projection_reference_date: string
  shared_link_count: number
}

interface BootstrapPayload {
  scope: BootstrapScope
  version: BootstrapVersion
  counts: {
    unresolved: number
    resolved: number
    detached: number
  }
  threads: unknown[]
  profiles: unknown[]
  accessibleScopes: unknown[]
  lastReadEventSeq: number
  threadReadStates: Array<{
    threadId: string
    latestCommentEventSeq: number
    lastReadEventSeq: number
    unread: boolean
  }>
}

interface BootstrapRepairEnvelope {
  ownerUserId: string
  resumeId: string
  versionId: number
  documentRevision: number
  snapshot: Record<string, unknown>
  projectionReferenceDate: string
}

type BootstrapRpcResult
  = | {
    protocolVersion: 1
    status: 'scope_missing'
    access: Pick<BootstrapAccessEnvelope, 'kind' | 'sharePasswordHash'>
    repair: BootstrapRepairEnvelope
  }
  | {
    protocolVersion: 1
    status: 'ok'
    access: BootstrapAccessEnvelope
    bootstrap: BootstrapPayload
    eventSeq: number
  }

type BootstrapTimingName
  = | 'auth_anonymous'
    | 'auth_local'
    | 'auth_legacy'
    | 'access_token'
    | 'rpc'
    | 'repair'
    | 'realtime_token'
    | 'serialize'
    | 'edge_total'

class BootstrapInternalError extends Error {
  readonly category: string

  constructor(category: string) {
    super('resume comments bootstrap internal failure')
    this.name = 'BootstrapInternalError'
    this.category = category
  }
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

function isUuidValue(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

function isPositiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0
}

function isDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value))
    return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function invalidBootstrapCredential(message = '评论访问凭证无效'): never {
  throw new CommentApiError('unauthorized', message, 401)
}

function validateCollaboratorTokenClaims(
  value: unknown,
  userId: string,
): {
  protocolVersion: 1 | 2
  scopeId: string
  resumeId: string
  userId: string
  sessionId: string
  versionId: number
  memberLeaseId: string | null
  role: 'editor' | 'viewer'
} {
  const protocolVersion = isRecord(value) && value.protocolVersion === 2 ? 2 : 1
  if (
    !isRecord(value)
    || value.kind !== 'collaborator'
    || !isUuidValue(value.scopeId)
    || !isUuidValue(value.resumeId)
    || !isUuidValue(value.userId)
    || value.userId !== userId
    || typeof value.sessionId !== 'string'
    || !COLLABORATION_SESSION_PATTERN.test(value.sessionId)
    || !isPositiveSafeInteger(value.versionId)
    || (value.role !== 'editor' && value.role !== 'viewer')
    || (protocolVersion === 2 && !isUuidValue(value.memberLeaseId))
    || (protocolVersion === 1 && value.protocolVersion !== undefined && value.protocolVersion !== 1)
    || (protocolVersion === 1 && value.memberLeaseId !== undefined)
  ) {
    return invalidBootstrapCredential('协作评论凭证无效')
  }
  return {
    protocolVersion,
    scopeId: value.scopeId,
    resumeId: value.resumeId,
    userId: value.userId,
    sessionId: value.sessionId,
    versionId: value.versionId,
    memberLeaseId: protocolVersion === 2 ? value.memberLeaseId as string : null,
    role: value.role === 'editor' ? 'editor' : 'viewer',
  }
}

function validateShareTokenClaims(value: unknown) {
  if (
    !isRecord(value)
    || value.kind !== 'share'
    || !isUuidValue(value.shareId)
    || !isUuidValue(value.releaseId)
    || !isUuidValue(value.scopeId)
    || !isPositiveSafeInteger(value.versionId)
    || typeof value.passwordGeneration !== 'string'
    || value.passwordGeneration.trim().length === 0
  ) {
    return invalidBootstrapCredential()
  }
  return {
    shareId: value.shareId,
    releaseId: value.releaseId,
    scopeId: value.scopeId,
    versionId: value.versionId,
    passwordGeneration: value.passwordGeneration,
  }
}

async function assertCollaboratorBootstrapLease(
  admin: AdminClient,
  lease: BootstrapInputContext['collaboratorLease'],
) {
  if (!lease)
    return

  const [sessionResult, memberResult] = await Promise.all([
    admin
      .from('resume_comment_collaboration_sessions')
      .select('session_id,resume_id,protocol_version,expires_at,revoked_at')
      .eq('session_id', lease.sessionId)
      .eq('resume_id', lease.resumeId)
      .eq('protocol_version', lease.protocolVersion)
      .maybeSingle(),
    admin
      .from('resume_comment_collaboration_members')
      .select('session_id,user_id,member_lease_id,protocol_version,expires_at,revoked_at')
      .eq('session_id', lease.sessionId)
      .eq('user_id', lease.userId)
      .eq('protocol_version', lease.protocolVersion)
      .maybeSingle(),
  ])
  const session = sessionResult.data as Pick<
    CollaborationSessionRow,
    'session_id' | 'resume_id' | 'protocol_version' | 'expires_at' | 'revoked_at'
  > | null
  const member = memberResult.data as Pick<
    CollaborationMemberRow,
    'session_id' | 'user_id' | 'member_lease_id' | 'protocol_version' | 'expires_at' | 'revoked_at'
  > | null

  if (
    sessionResult.error
    || memberResult.error
    || !session
    || !member
    || session.revoked_at
    || member.revoked_at
    || !isFutureTimestamp(session.expires_at)
    || !isFutureTimestamp(member.expires_at)
    || (lease.protocolVersion === 2 && member.member_lease_id !== lease.memberLeaseId)
  ) {
    throw new CommentApiError('unauthorized', '协作评论凭证已失效', 401)
  }
}

async function buildBootstrapInput({
  userId,
  body,
  tokenSecret,
  collaboratorSecret,
  anonymousPepper,
}: {
  userId: string | null
  body: Record<string, unknown>
  tokenSecret: string
  collaboratorSecret: string
  anonymousPepper: string
}): Promise<BootstrapInputContext> {
  const accessKind = readRequiredString(body, 'accessKind', 32)
  if (accessKind === 'owner') {
    if (!userId)
      return invalidBootstrapCredential('请先登录')
    if (body.historyVersionId !== undefined || body.shareReleaseId !== undefined) {
      throw new CommentApiError('not_found', '评论访问参数无效', 400)
    }
    const locatorKeys = ['scopeId', 'resumeId', 'versionId']
      .filter(key => body[key] !== undefined)
    if (locatorKeys.length !== 1) {
      throw new CommentApiError('not_found', '评论访问参数无效', 400)
    }
    let scopeId: string | null = null
    let resumeId: string | null = null
    let versionId: number | null = null
    if (locatorKeys[0] === 'scopeId') {
      scopeId = readUuid(body, 'scopeId')
    }
    else if (locatorKeys[0] === 'resumeId') {
      resumeId = readUuid(body, 'resumeId')
    }
    else {
      const requestedVersionId = readNonNegativeInteger(body, 'versionId')
      if (!isPositiveSafeInteger(requestedVersionId))
        throw new CommentApiError('not_found', '简历版本不存在', 404)
      versionId = requestedVersionId
    }
    return {
      shareTokenSecret: null,
      collaboratorLease: null,
      rpcInput: {
        p_protocol_version: 1,
        p_access_kind: 'owner',
        p_user_id: userId,
        p_scope_id: scopeId,
        p_resume_id: resumeId,
        p_version_id: versionId,
        p_share_id: null,
        p_release_id: null,
        p_password_generation: null,
        p_session_id: null,
        p_collaborator_role: null,
        p_anonymous_id: null,
        p_anonymous_secret_hash: null,
      },
    }
  }

  if (accessKind === 'collaborator') {
    if (!userId)
      return invalidBootstrapCredential('请先登录')
    const verifiedToken = await verifyCommentToken(
      readRequiredString(body, 'accessToken', 4_096),
      'collaborator',
      collaboratorSecret,
    )
    const token = validateCollaboratorTokenClaims(verifiedToken, userId)
    return {
      shareTokenSecret: null,
      collaboratorLease: {
        protocolVersion: token.protocolVersion,
        sessionId: token.sessionId,
        resumeId: token.resumeId,
        userId: token.userId,
        memberLeaseId: token.memberLeaseId,
      },
      rpcInput: {
        p_protocol_version: 1,
        p_access_kind: 'collaborator',
        p_user_id: userId,
        p_scope_id: token.scopeId,
        p_resume_id: token.resumeId,
        p_version_id: token.versionId,
        p_share_id: null,
        p_release_id: null,
        p_password_generation: null,
        p_session_id: token.sessionId,
        p_collaborator_role: token.role,
        p_anonymous_id: null,
        p_anonymous_secret_hash: null,
      },
    }
  }

  if (accessKind !== 'share')
    return invalidBootstrapCredential('评论访问方式无效')
  const verifiedToken = await verifyCommentToken(
    readRequiredString(body, 'accessToken', 4_096),
    'share',
    tokenSecret,
  )
  const token = validateShareTokenClaims(verifiedToken)
  let anonymousId: string | null = null
  let anonymousSecretHash: string | null = null
  if (isRecord(body.anonymous)) {
    try {
      anonymousId = readUuid(body.anonymous, 'id')
      const anonymousSecret = readRequiredString(body.anonymous, 'secret', 128)
      anonymousSecretHash = await hashAnonymousSecret(anonymousSecret, anonymousPepper)
    }
    catch {
      if (!userId)
        return invalidBootstrapCredential('匿名评论凭证无效')
      anonymousId = null
      anonymousSecretHash = null
    }
  }
  return {
    shareTokenSecret: tokenSecret,
    collaboratorLease: null,
    rpcInput: {
      p_protocol_version: 1,
      p_access_kind: 'share',
      p_user_id: userId,
      p_scope_id: token.scopeId,
      p_resume_id: null,
      p_version_id: token.versionId,
      p_share_id: token.shareId,
      p_release_id: token.releaseId,
      p_password_generation: token.passwordGeneration,
      p_session_id: null,
      p_collaborator_role: null,
      p_anonymous_id: anonymousId,
      p_anonymous_secret_hash: anonymousSecretHash,
    },
  }
}

function bootstrapProtocolError(category: string): never {
  throw new BootstrapInternalError(category)
}

function readProtocolNullableUuid(
  value: Record<string, unknown>,
  field: string,
): string | null {
  if (value[field] === null)
    return null
  if (!isUuidValue(value[field]))
    return bootstrapProtocolError('invalid_rpc_protocol')
  return value[field]
}

function readProtocolNullableString(
  value: Record<string, unknown>,
  field: string,
): string | null {
  if (value[field] === null)
    return null
  if (typeof value[field] !== 'string')
    return bootstrapProtocolError('invalid_rpc_protocol')
  return value[field]
}

function validateBootstrapAccess(
  value: unknown,
  input: BootstrapRpcInput,
): BootstrapAccessEnvelope {
  if (!isRecord(value))
    return bootstrapProtocolError('invalid_rpc_protocol')
  const userId = readProtocolNullableUuid(value, 'userId')
  const actorId = readProtocolNullableUuid(value, 'actorId')
  const legacyAnonymousId = readProtocolNullableUuid(value, 'legacyAnonymousId')
  const shareId = readProtocolNullableUuid(value, 'shareId')
  const releaseId = readProtocolNullableUuid(value, 'releaseId')
  const sharePasswordHash = readProtocolNullableString(value, 'sharePasswordHash')
  if (
    value.kind !== input.p_access_kind
    || userId !== input.p_user_id
    || (value.actorKind !== null && value.actorKind !== 'user' && value.actorKind !== 'anonymous')
    || (typeof value.actorKey !== 'string' && value.actorKey !== null)
    || typeof value.canWrite !== 'boolean'
    || typeof value.canManageAll !== 'boolean'
    || !isUuidValue(value.scopeId)
    || !isPositiveSafeInteger(value.versionId)
    || !isUuidValue(value.ownerUserId)
    || (input.p_scope_id !== null && value.scopeId !== input.p_scope_id)
    || (input.p_version_id !== null && value.versionId !== input.p_version_id)
  ) {
    return bootstrapProtocolError('invalid_rpc_protocol')
  }

  if (input.p_access_kind === 'owner') {
    if (
      userId === null
      || value.ownerUserId !== userId
      || value.actorKind !== 'user'
      || actorId !== userId
      || value.actorKey !== `user:${userId}`
      || legacyAnonymousId !== null
      || shareId !== null
      || releaseId !== null
      || sharePasswordHash !== null
      || value.canWrite !== true
      || value.canManageAll !== true
    ) {
      return bootstrapProtocolError('invalid_rpc_protocol')
    }
  }
  else if (input.p_access_kind === 'collaborator') {
    if (
      userId === null
      || value.actorKind !== 'user'
      || actorId !== userId
      || value.actorKey !== `user:${userId}`
      || legacyAnonymousId !== null
      || shareId !== null
      || releaseId !== null
      || sharePasswordHash !== null
      || value.canWrite !== (input.p_collaborator_role === 'editor')
      || value.canManageAll !== false
    ) {
      return bootstrapProtocolError('invalid_rpc_protocol')
    }
  }
  else {
    if (
      shareId !== input.p_share_id
      || releaseId !== input.p_release_id
      || value.canManageAll !== false
    ) {
      return bootstrapProtocolError('invalid_rpc_protocol')
    }
    if (userId !== null) {
      if (
        value.actorKind !== 'user'
        || actorId !== userId
        || value.actorKey !== `user:${userId}`
        || (legacyAnonymousId !== null && legacyAnonymousId !== input.p_anonymous_id)
      ) {
        return bootstrapProtocolError('invalid_rpc_protocol')
      }
    }
    else if (input.p_anonymous_id !== null) {
      if (
        value.actorKind !== 'anonymous'
        || actorId !== input.p_anonymous_id
        || value.actorKey !== `anonymous:${input.p_anonymous_id}`
        || legacyAnonymousId !== null
      ) {
        return bootstrapProtocolError('invalid_rpc_protocol')
      }
    }
    else if (
      value.actorKind !== null
      || actorId !== null
      || value.actorKey !== null
      || legacyAnonymousId !== null
    ) {
      return bootstrapProtocolError('invalid_rpc_protocol')
    }
  }

  return {
    kind: input.p_access_kind,
    userId,
    actorKind: value.actorKind === 'user' || value.actorKind === 'anonymous'
      ? value.actorKind
      : null,
    actorId,
    actorKey: typeof value.actorKey === 'string' ? value.actorKey : null,
    legacyAnonymousId,
    canWrite: value.canWrite,
    canManageAll: value.canManageAll,
    scopeId: value.scopeId,
    versionId: value.versionId,
    ownerUserId: value.ownerUserId,
    shareId,
    releaseId,
    sharePasswordHash,
  }
}

function validateBootstrapPayload(
  value: unknown,
  access: BootstrapAccessEnvelope,
  eventSeq: number,
): BootstrapPayload {
  if (!isRecord(value))
    return bootstrapProtocolError('invalid_rpc_protocol')
  const scopeValue = value.scope
  const versionValue = value.version
  const countsValue = value.counts
  if (
    !isRecord(scopeValue)
    || !isRecord(versionValue)
    || !isRecord(countsValue)
    || !Array.isArray(value.threads)
    || !Array.isArray(value.profiles)
    || !Array.isArray(value.accessibleScopes)
    || !Array.isArray(value.threadReadStates)
    || !isNonNegativeSafeInteger(value.lastReadEventSeq)
  ) {
    return bootstrapProtocolError('invalid_rpc_protocol')
  }
  const anchorDocument = scopeValue.anchor_document
  if (
    scopeValue.kind !== 'version'
    || scopeValue.id !== access.scopeId
    || scopeValue.owner_user_id !== access.ownerUserId
    || !isUuidValue(scopeValue.resume_id)
    || scopeValue.version_id !== access.versionId
    || scopeValue.history_version_id !== null
    || scopeValue.share_release_id !== null
    || typeof scopeValue.document_hash !== 'string'
    || !isNonNegativeSafeInteger(scopeValue.document_revision)
    || !isDateOnly(scopeValue.projection_reference_date)
    || scopeValue.next_event_seq !== eventSeq
    || scopeValue.archived_at !== null
    || !isRecord(anchorDocument)
    || !Array.isArray(anchorDocument.nodes)
    || !anchorDocument.nodes.every(node => (
      isRecord(node) && typeof node.nodeKey === 'string'
    ))
    || versionValue.id !== access.versionId
    || !isNonNegativeSafeInteger(versionValue.version_no)
    || (versionValue.version_name !== null && typeof versionValue.version_name !== 'string')
    || (versionValue.milestone_name !== null && typeof versionValue.milestone_name !== 'string')
    || (versionValue.status !== 'active' && versionValue.status !== 'frozen')
    || (versionValue.content_hash !== null && typeof versionValue.content_hash !== 'string')
    || !isNonNegativeSafeInteger(versionValue.document_revision)
    || !isDateOnly(versionValue.projection_reference_date)
    || !isNonNegativeSafeInteger(versionValue.shared_link_count)
    || !isNonNegativeSafeInteger(countsValue.unresolved)
    || !isNonNegativeSafeInteger(countsValue.resolved)
    || !isNonNegativeSafeInteger(countsValue.detached)
    || value.accessibleScopes.length !== 1
  ) {
    return bootstrapProtocolError('invalid_rpc_protocol')
  }
  const accessibleScope = value.accessibleScopes[0]
  if (
    !isRecord(accessibleScope)
    || accessibleScope.id !== access.scopeId
    || accessibleScope.owner_user_id !== access.ownerUserId
    || accessibleScope.version_id !== access.versionId
    || accessibleScope.next_event_seq !== eventSeq
    || accessibleScope.last_read_event_seq !== value.lastReadEventSeq
  ) {
    return bootstrapProtocolError('invalid_rpc_protocol')
  }
  const threadIds = new Set<string>()
  const threadReadStates = value.threadReadStates.map((item) => {
    if (
      !isRecord(item)
      || !isUuidValue(item.threadId)
      || threadIds.has(item.threadId)
      || !isNonNegativeSafeInteger(item.latestCommentEventSeq)
      || !isNonNegativeSafeInteger(item.lastReadEventSeq)
      || item.latestCommentEventSeq > eventSeq
      || item.lastReadEventSeq > eventSeq
      || typeof item.unread !== 'boolean'
      || item.unread !== (item.latestCommentEventSeq > item.lastReadEventSeq)
    ) {
      return bootstrapProtocolError('invalid_rpc_protocol')
    }
    threadIds.add(item.threadId)
    return {
      threadId: item.threadId,
      latestCommentEventSeq: item.latestCommentEventSeq,
      lastReadEventSeq: item.lastReadEventSeq,
      unread: item.unread,
    }
  })
  const payloadThreadIds = new Set(value.threads.flatMap((thread) => {
    if (!isRecord(thread) || !isUuidValue(thread.id))
      return bootstrapProtocolError('invalid_rpc_protocol')
    return [thread.id]
  }))
  if (
    payloadThreadIds.size !== threadIds.size
    || [...payloadThreadIds].some(threadId => !threadIds.has(threadId))
  ) {
    return bootstrapProtocolError('invalid_rpc_protocol')
  }
  const nodes = anchorDocument.nodes.map((node) => {
    if (!isRecord(node) || typeof node.nodeKey !== 'string')
      return bootstrapProtocolError('invalid_rpc_protocol')
    return { nodeKey: node.nodeKey }
  })
  const scope: BootstrapScope = {
    id: scopeValue.id,
    kind: 'version',
    owner_user_id: scopeValue.owner_user_id,
    resume_id: scopeValue.resume_id,
    version_id: scopeValue.version_id,
    history_version_id: null,
    share_release_id: null,
    anchor_document: { nodes },
    document_hash: scopeValue.document_hash,
    document_revision: scopeValue.document_revision,
    projection_reference_date: scopeValue.projection_reference_date,
    next_event_seq: scopeValue.next_event_seq,
    archived_at: null,
  }
  const versionName = typeof versionValue.version_name === 'string'
    ? versionValue.version_name
    : null
  const milestoneName = typeof versionValue.milestone_name === 'string'
    ? versionValue.milestone_name
    : null
  const contentHash = typeof versionValue.content_hash === 'string'
    ? versionValue.content_hash
    : null
  return {
    scope,
    version: {
      id: versionValue.id,
      version_no: versionValue.version_no,
      version_name: versionName,
      milestone_name: milestoneName,
      status: versionValue.status,
      content_hash: contentHash,
      document_revision: versionValue.document_revision,
      projection_reference_date: versionValue.projection_reference_date,
      shared_link_count: versionValue.shared_link_count,
    },
    counts: {
      unresolved: countsValue.unresolved,
      resolved: countsValue.resolved,
      detached: countsValue.detached,
    },
    threads: value.threads,
    profiles: value.profiles,
    accessibleScopes: [{
      ...scope,
      last_read_event_seq: value.lastReadEventSeq,
    }],
    lastReadEventSeq: value.lastReadEventSeq,
    threadReadStates,
  }
}

function validateBootstrapRpcResult(
  value: unknown,
  input: BootstrapRpcInput,
): BootstrapRpcResult {
  if (
    !isRecord(value)
    || value.protocolVersion !== 1
    || (value.status !== 'ok' && value.status !== 'scope_missing')
  ) {
    return bootstrapProtocolError('invalid_rpc_protocol')
  }
  if (value.status === 'scope_missing') {
    if (
      input.p_access_kind === 'collaborator'
      || !isRecord(value.access)
      || value.access.kind !== input.p_access_kind
      || (value.access.sharePasswordHash !== null
        && typeof value.access.sharePasswordHash !== 'string')
      || (input.p_access_kind === 'owner' && value.access.sharePasswordHash !== null)
      || !isRecord(value.repair)
      || !isUuidValue(value.repair.ownerUserId)
      || !isUuidValue(value.repair.resumeId)
      || !isPositiveSafeInteger(value.repair.versionId)
      || !isPositiveSafeInteger(value.repair.documentRevision)
      || !isRecord(value.repair.snapshot)
      || !isDateOnly(value.repair.projectionReferenceDate)
      || (input.p_version_id !== null && value.repair.versionId !== input.p_version_id)
      || (input.p_resume_id !== null && value.repair.resumeId !== input.p_resume_id)
      || (input.p_access_kind === 'owner' && value.repair.ownerUserId !== input.p_user_id)
    ) {
      return bootstrapProtocolError('invalid_rpc_protocol')
    }
    return {
      protocolVersion: 1,
      status: 'scope_missing',
      access: {
        kind: input.p_access_kind,
        sharePasswordHash: typeof value.access.sharePasswordHash === 'string'
          ? value.access.sharePasswordHash
          : null,
      },
      repair: {
        ownerUserId: value.repair.ownerUserId,
        resumeId: value.repair.resumeId,
        versionId: value.repair.versionId,
        documentRevision: value.repair.documentRevision,
        snapshot: value.repair.snapshot,
        projectionReferenceDate: value.repair.projectionReferenceDate,
      },
    }
  }
  if (!isNonNegativeSafeInteger(value.eventSeq))
    return bootstrapProtocolError('invalid_rpc_protocol')
  const access = validateBootstrapAccess(value.access, input)
  return {
    protocolVersion: 1,
    status: 'ok',
    access,
    bootstrap: validateBootstrapPayload(value.bootstrap, access, value.eventSeq),
    eventSeq: value.eventSeq,
  }
}

function mapBootstrapRpcError(error: unknown): CommentApiError {
  if (!isRecord(error) || typeof error.code !== 'string' || typeof error.message !== 'string')
    return bootstrapProtocolError('unexpected_rpc_error')
  const mapping: Record<string, CommentApiError> = {
    '42501:unauthorized': new CommentApiError('unauthorized', '没有权限访问评论', 401),
    'P0002:not_found': new CommentApiError('not_found', '评论空间不存在', 404),
    'P0404:share_unavailable': new CommentApiError('share_unavailable', '分享已不可用', 404),
    'P0403:comments_disabled': new CommentApiError('comments_disabled', '当前分享已关闭评论', 403),
    'P0409:stale_release': new CommentApiError('stale_release', '分享版本已变化，请刷新后重试', 409),
  }
  return mapping[`${error.code}:${error.message}`]
    ?? bootstrapProtocolError('unexpected_rpc_error')
}

function mapBootstrapRepairError(error: unknown): CommentApiError {
  if (
    isRecord(error)
    && error.code === 'P0409'
    && error.message === 'stale_document'
  ) {
    return new CommentApiError(
      'stale_document',
      '简历内容已变化，请刷新后重试',
      409,
    )
  }
  return bootstrapProtocolError('scope_repair_failed')
}

async function bootstrapResumeComments(
  admin: AdminClient,
  input: BootstrapRpcInput,
  collaboratorLease: BootstrapInputContext['collaboratorLease'],
): Promise<BootstrapRpcResult> {
  const { data, error } = await admin.rpc(
    'bootstrap_resume_comments_with_collaboration_lease_v2',
    {
      ...input,
      p_collaboration_protocol_version: collaboratorLease?.protocolVersion ?? null,
      p_member_lease_id: collaboratorLease?.memberLeaseId ?? null,
    },
  )
  if (error)
    throw mapBootstrapRpcError(error)
  return validateBootstrapRpcResult(data, input)
}

async function assertCurrentSharePasswordGeneration({
  result,
  input,
  tokenSecret,
}: {
  result: BootstrapRpcResult
  input: BootstrapRpcInput
  tokenSecret: string | null
}) {
  if (input.p_access_kind !== 'share')
    return
  if (!tokenSecret || input.p_password_generation === null)
    return bootstrapProtocolError('invalid_share_password_context')
  const currentGeneration = await derivePasswordGeneration(
    result.access.sharePasswordHash,
    tokenSecret,
  )
  if (!timingSafeStringEqual(currentGeneration, input.p_password_generation)) {
    throw new CommentApiError(
      'share_unavailable',
      '分享访问状态已变化，请重新验证',
      401,
    )
  }
}

async function repairBootstrapScope(
  admin: AdminClient,
  repair: BootstrapRepairEnvelope,
): Promise<string> {
  try {
    const projected = buildCommentAnchorDocument(
      repair.snapshot,
      repair.projectionReferenceDate,
    )
    const { data, error } = await admin.rpc('ensure_resume_version_comment_scope', {
      p_owner_user_id: repair.ownerUserId,
      p_version_id: repair.versionId,
      p_anchor_document: projected.document,
      p_document_hash: projected.documentHash,
      p_projection_reference_date: repair.projectionReferenceDate,
      p_expected_document_revision: repair.documentRevision,
    })
    if (error)
      throw mapBootstrapRepairError(error)
    if (!isUuidValue(data))
      return bootstrapProtocolError('invalid_scope_repair_result')
    return data
  }
  catch (error) {
    if (error instanceof BootstrapInternalError || error instanceof CommentApiError)
      throw error
    return bootstrapProtocolError('scope_repair_failed')
  }
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
      p_expected_document_revision: version.document_revision,
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
  const session = await getCollaborationSession(admin, sessionId, resumeId)
  if (!session || session.revoked_at || !isFutureTimestamp(session.expires_at)) {
    throw new CommentApiError('unauthorized', '协作会话已结束或不存在', 401)
  }
  return session
}

async function getCollaborationSession(
  admin: AdminClient,
  sessionId: string,
  resumeId: string,
) {
  const { data, error } = await admin
    .from('resume_comment_collaboration_sessions')
    .select('session_id,resume_id,scope_id,owner_user_id,host_lease_id,default_role,expires_at,revoked_at,protocol_version')
    .eq('session_id', sessionId)
    .eq('resume_id', resumeId)
    .maybeSingle()
  if (error)
    throw error
  return data as CollaborationSessionRow | null
}

async function loadCollaborationDocumentBootstrap(
  admin: AdminClient,
  session: CollaborationSessionRow,
) {
  const { data, error } = await admin
    .from('automerge_documents')
    .select('document_data,heads,document_version,updated_at')
    .eq('resume_id', session.resume_id)
    .eq('user_id', session.owner_user_id)
    .maybeSingle()

  if (error) {
    throw error
  }

  const row = data as CollaborationDocumentRow | null
  if (!row || typeof row.document_data !== 'string' || row.document_data.length === 0) {
    throw new CommentApiError(
      'collaboration_snapshot_unavailable',
      '共享简历快照暂时不可用',
      409,
    )
  }

  return {
    documentData: row.document_data,
    heads: Array.isArray(row.heads) ? row.heads : [],
    documentVersion: Number.isFinite(row.document_version) ? row.document_version : 1,
    updatedAt: row.updated_at,
  }
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
      protocolVersion: session.protocol_version,
      ...(session.protocol_version === 2
        ? { memberLeaseId: member.member_lease_id }
        : {}),
    }, collaboratorSecret),
    expiresAt: new Date(expiresAt * 1_000).toISOString(),
    sessionId: session.session_id,
    resumeId: session.resume_id,
    versionId,
    userId: member.user_id,
    protocolVersion: session.protocol_version,
    ...(session.protocol_version === 2
      ? { memberLeaseId: member.member_lease_id }
      : {}),
    role: member.role,
  }
}

function readCollaborationProtocolVersion(body: Record<string, unknown>): 1 | 2 {
  if (body.protocolVersion === undefined)
    return 1
  if (body.protocolVersion === 1 || body.protocolVersion === 2)
    return body.protocolVersion
  throw new CommentApiError('not_found', '协作协议版本无效', 400)
}

function readSupportedCollaborationProtocolVersions(
  body: Record<string, unknown>,
): ReadonlySet<1 | 2> {
  if (body.supportedProtocolVersions === undefined)
    return new Set()
  if (
    !Array.isArray(body.supportedProtocolVersions)
    || body.supportedProtocolVersions.length === 0
    || body.supportedProtocolVersions.some(value => value !== 1 && value !== 2)
  ) {
    throw new CommentApiError('not_found', '协作协议能力声明无效', 400)
  }
  return new Set(body.supportedProtocolVersions as Array<1 | 2>)
}

function negotiateCollaborationProtocolVersion(
  requested: 1 | 2,
  supported: ReadonlySet<1 | 2>,
  existing: 1 | 2,
) {
  if (requested === existing || supported.has(existing))
    return existing
  throw new CommentApiError('unauthorized', '协作协议版本不匹配', 401)
}

function throwCollaborationRpcError(error: unknown): never {
  if (isRecord(error) && typeof error.code === 'string' && typeof error.message === 'string') {
    const mapping: Record<string, CommentApiError> = {
      '42501:unauthorized': new CommentApiError('unauthorized', '协作会话已结束或不存在', 401),
      'P0409:owner_must_host': new CommentApiError('owner_must_host', '简历所有者应恢复为协作发起者', 409),
      'P0409:collaboration_session_conflict': new CommentApiError('collaboration_session_conflict', '协作会话标识已被占用', 409),
      'P0409:session_id_retired': new CommentApiError('session_id_retired', '协作会话标识已永久失效，请重新开启协作', 409),
      'P0409:member_protocol_conflict': new CommentApiError('member_protocol_conflict', '协作协议版本冲突', 409),
      'P0409:member_lease_conflict': new CommentApiError('member_lease_conflict', '该账号已在另一窗口加入此协作', 409),
      'P0409:member_lease_retired': new CommentApiError('member_lease_retired', '协作者成员租约已失效，请重新打开邀请', 409),
      '22023:invalid_collaboration_claim': new CommentApiError('not_found', '协作会话参数无效', 400),
      '22023:invalid_member_claim': new CommentApiError('not_found', '协作者成员租约无效', 400),
    }
    const mapped = mapping[`${error.code}:${error.message}`]
    if (mapped)
      throw mapped
  }
  throw error
}

function readClaimedMember(value: unknown): CollaborationMemberRow {
  if (
    !isRecord(value)
    || !isUuidValue(value.userId)
    || !isUuidValue(value.memberLeaseId)
    || typeof value.sessionId !== 'string'
    || !COLLABORATION_SESSION_PATTERN.test(value.sessionId)
    || (value.protocolVersion !== 1 && value.protocolVersion !== 2)
    || (value.role !== 'editor' && value.role !== 'viewer')
    || typeof value.expiresAt !== 'string'
    || (value.revokedAt !== null && typeof value.revokedAt !== 'string')
  ) {
    throw new Error('Invalid collaboration member claim response')
  }
  return {
    session_id: value.sessionId,
    user_id: value.userId,
    member_lease_id: value.memberLeaseId,
    protocol_version: value.protocolVersion,
    role: value.role,
    expires_at: value.expiresAt,
    revoked_at: value.revokedAt,
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
  const requestedProtocolVersion = readCollaborationProtocolVersion(body)
  const supportedProtocolVersions = readSupportedCollaborationProtocolVersions(body)

  if (op === 'register_collaboration_session') {
    const versionId = await resolveCurrentVersionId(admin, userId, resumeId)
    const scope = await ensureVersionScopeForOwner(admin, userId, versionId)
    const existingSession = await getCollaborationSession(admin, sessionId, resumeId)
    const protocolVersion = existingSession
      ? negotiateCollaborationProtocolVersion(
          requestedProtocolVersion,
          supportedProtocolVersions,
          existingSession.protocol_version,
        )
      : requestedProtocolVersion
    const requestedExpiresAt = new Date(Date.now() + 8 * 60 * 60 * 1_000).toISOString()
    const { data, error } = await admin.rpc('claim_resume_comment_collaboration_session_v2', {
      p_session_id: sessionId,
      p_resume_id: resumeId,
      p_scope_id: scope.id,
      p_owner_user_id: userId,
      p_default_role: 'editor',
      p_expires_at: requestedExpiresAt,
      p_protocol_version: protocolVersion,
    })
    if (error)
      return throwCollaborationRpcError(error)
    if (
      !isRecord(data)
      || data.sessionId !== sessionId
      || data.resumeId !== resumeId
      || data.protocolVersion !== protocolVersion
      || !isUuidValue(data.hostLeaseId)
      || typeof data.expiresAt !== 'string'
    ) {
      throw new Error('Invalid collaboration session claim response')
    }
    return {
      sessionId,
      resumeId,
      expiresAt: data.expiresAt,
      hostLeaseId: data.hostLeaseId,
      protocolVersion,
    }
  }

  if (op === 'leave_collaboration_session') {
    const session = await getCollaborationSession(admin, sessionId, resumeId)
    if (!session) {
      return { sessionId, revoked: false, protocolVersion: requestedProtocolVersion }
    }
    const protocolVersion = negotiateCollaborationProtocolVersion(
      requestedProtocolVersion,
      supportedProtocolVersions,
      session.protocol_version,
    )

    if (session.owner_user_id === userId) {
      const hostLeaseId = readUuid(body, 'hostLeaseId')
      const { data, error } = await admin.rpc('revoke_resume_comment_collaboration_session_v2', {
        p_session_id: sessionId,
        p_resume_id: resumeId,
        p_owner_user_id: userId,
        p_host_lease_id: hostLeaseId,
        p_protocol_version: protocolVersion,
      })
      if (error)
        return throwCollaborationRpcError(error)
      return { sessionId, revoked: data === true, protocolVersion }
    }

    const memberLeaseId = protocolVersion === 2 ? readUuid(body, 'memberLeaseId') : null
    const { data, error } = await admin.rpc('release_resume_comment_collaboration_member_v2', {
      p_session_id: sessionId,
      p_resume_id: resumeId,
      p_user_id: userId,
      p_member_lease_id: memberLeaseId,
      p_protocol_version: protocolVersion,
    })
    if (error)
      return throwCollaborationRpcError(error)
    return { sessionId, revoked: data === true, protocolVersion }
  }

  const session = await getActiveCollaborationSession(admin, sessionId, resumeId)
  if (op === 'join_collaboration_session' && session.owner_user_id === userId) {
    throw new CommentApiError(
      'owner_must_host',
      '简历所有者应恢复为协作发起者',
      409,
    )
  }
  const protocolVersion = negotiateCollaborationProtocolVersion(
    requestedProtocolVersion,
    supportedProtocolVersions,
    session.protocol_version,
  )

  let member: CollaborationMemberRow
  if (op === 'join_collaboration_session') {
    const memberLeaseId = protocolVersion === 2 ? readUuid(body, 'memberLeaseId') : null
    const { data, error } = await admin.rpc('claim_resume_comment_collaboration_member_v2', {
      p_session_id: sessionId,
      p_resume_id: resumeId,
      p_user_id: userId,
      p_member_lease_id: memberLeaseId,
      p_protocol_version: protocolVersion,
    })
    if (error)
      return throwCollaborationRpcError(error)
    member = readClaimedMember(data)
  }
  else {
    const memberLeaseId = protocolVersion === 2 ? readUuid(body, 'memberLeaseId') : null
    if (protocolVersion === 2) {
      const { data, error } = await admin.rpc('renew_resume_comment_collaboration_member_v2', {
        p_session_id: sessionId,
        p_resume_id: resumeId,
        p_user_id: userId,
        p_member_lease_id: memberLeaseId,
        p_protocol_version: protocolVersion,
      })
      if (error)
        return throwCollaborationRpcError(error)
      member = readClaimedMember(data)
    }
    else {
      const { data, error } = await admin
        .from('resume_comment_collaboration_members')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .eq('protocol_version', 1)
        .is('revoked_at', null)
        .gt('expires_at', new Date().toISOString())
        .select('session_id,user_id,member_lease_id,protocol_version,role,expires_at,revoked_at')
        .maybeSingle()
      if (error)
        throw error
      if (!data) {
        throw new CommentApiError('unauthorized', '协作者评论权限已失效', 401)
      }
      member = data as CollaborationMemberRow
    }
  }

  if (
    member.protocol_version !== protocolVersion
    || member.session_id !== sessionId
    || member.user_id !== userId
  ) {
    throw new CommentApiError('unauthorized', '协作者评论权限不存在', 401)
  }
  const scope = await getScope(admin, session.scope_id)
  if (scope.kind !== 'version' || scope.version_id == null)
    throw new CommentApiError('unauthorized', '协作评论版本无效', 401)
  const commentAccess = await issueCollaboratorToken({
    session,
    member,
    versionId: scope.version_id,
    collaboratorSecret,
  })
  if (op === 'renew_collaboration_session') {
    return commentAccess
  }
  const bootstrap = await loadCollaborationDocumentBootstrap(admin, session)

  return { ...commentAccess, bootstrap }
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
    const verifiedToken = await verifyCommentToken(
      readRequiredString(body, 'accessToken', 4_096),
      'collaborator',
      collaboratorSecret,
    )
    const token = validateCollaboratorTokenClaims(verifiedToken, userId)
    let memberQuery = admin
      .from('resume_comment_collaboration_members')
      .select('session_id,user_id,member_lease_id,protocol_version,role,expires_at,revoked_at')
      .eq('session_id', token.sessionId)
      .eq('user_id', userId)
      .eq('protocol_version', token.protocolVersion)
    if (token.protocolVersion === 2) {
      memberQuery = memberQuery.eq('member_lease_id', token.memberLeaseId)
    }
    const [scope, sessionResult, memberResult] = await Promise.all([
      getScope(admin, token.scopeId),
      admin
        .from('resume_comment_collaboration_sessions')
        .select('session_id,resume_id,scope_id,owner_user_id,host_lease_id,default_role,expires_at,revoked_at,protocol_version')
        .eq('session_id', token.sessionId)
        .eq('protocol_version', token.protocolVersion)
        .maybeSingle(),
      memberQuery.maybeSingle(),
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
      || token.protocolVersion !== session.protocol_version
      || token.protocolVersion !== member.protocol_version
      || (token.protocolVersion === 2 && token.memberLeaseId !== member.member_lease_id)
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

// 旧 bootstrap/recovery 快速回滚仍需保留此读取器。
// eslint-disable-next-line no-unused-vars, unused-imports/no-unused-vars
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

// 旧 bootstrap/recovery 快速回滚仍需保留此读取器。
// eslint-disable-next-line no-unused-vars, unused-imports/no-unused-vars
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
  if (isRecord(error) && error.code === '40P01') {
    return new CommentApiError(
      'database_deadlock',
      '请求发生并发冲突，请重试',
      409,
    )
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
  const context = createRequestContext(req, 'resume-comments', 'allowlist')
  const requestStartedAt = performance.now()
  const coldStart = nextRequestIsColdStart
  nextRequestIsColdStart = false
  const requestId = context.requestId
  const operationDurations: Partial<Record<BootstrapTimingName, number>> = {}
  let operation = 'comment_request'
  let responseErrorCode: string | undefined
  let responseSqlState: string | undefined
  let adminForMetrics: AdminClient | null = null
  let metricRecorded = false
  const recordTiming = (name: BootstrapTimingName, duration: number) => {
    operationDurations[name] = (operationDurations[name] ?? 0) + duration
  }
  const timeOperation = async <T>(
    name: BootstrapTimingName,
    operation: () => Promise<T>,
  ) => {
    const startedAt = performance.now()
    try {
      return await operation()
    }
    finally {
      recordTiming(name, performance.now() - startedAt)
    }
  }
  const finalize = (response: Response) => {
    operationDurations.edge_total = performance.now() - requestStartedAt
    const sharedHeaders = context.responseHeaders()
    sharedHeaders.forEach((value, key) => response.headers.set(key, value))
    response.headers.set(
      'Server-Timing',
      Object.entries(operationDurations)
        .map(([name, duration]) => `${name};dur=${duration.toFixed(1)}`)
        .join(', '),
    )
    if (adminForMetrics && !metricRecorded) {
      metricRecorded = true
      const outcome = response.status >= 500
        ? 'server_error' as const
        : response.status >= 400
          ? 'client_error' as const
          : 'success' as const
      scheduleBackground(recordOperationMetric(adminForMetrics, {
        requestId,
        functionName: 'resume-comments',
        operation,
        outcome,
        errorCode: responseErrorCode,
        sqlState: responseSqlState,
        status: response.status,
        durationMs: context.durationMs(),
      }), 'operation_metric_failed')
      if (response.status >= 500 || responseErrorCode === 'database_deadlock') {
        context.log({
          level: responseErrorCode === 'database_deadlock' ? 'warn' : 'error',
          event: 'request_failed',
          operation,
          status: response.status,
          errorCode: responseErrorCode ?? 'unexpected',
          sqlState: responseSqlState,
        })
      }
    }
    return response
  }
  const json = (body: unknown, status = 200) => {
    const serializeStartedAt = performance.now()
    const serializedBody = JSON.stringify(body)
    recordTiming('serialize', performance.now() - serializeStartedAt)
    return new Response(serializedBody, {
      status,
      headers: context.responseHeaders({
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      }),
    })
  }
  const success = (data: unknown, eventSeq: number) => {
    responseErrorCode = undefined
    responseSqlState = undefined
    return json({ ok: true, data, eventSeq })
  }
  const failure = (error: CommentApiError) => {
    responseErrorCode = error.code
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
  if (req.method === 'OPTIONS') {
    const response = corsPreflightResponse(req, 'allowlist')
    response.headers.set('X-Request-Id', requestId)
    return response
  }
  if (!isOriginAllowed(req, 'allowlist')) {
    context.log({
      level: 'warn',
      event: 'request_rejected',
      operation,
      status: 403,
      errorCode: 'origin_forbidden',
    })
    return context.json({ error: 'origin_forbidden' }, 403)
  }
  if (req.method !== 'POST') {
    return finalize(failure(new CommentApiError('not_found', '接口不存在', 404)))
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    context.log({
      level: 'error',
      event: 'request_failed',
      operation,
      status: 500,
      errorCode: 'service_not_configured',
    })
    return finalize(failure(new CommentApiError('unexpected', '评论服务暂时不可用', 500)))
  }
  const tokenSecret = Deno.env.get('RESUME_COMMENT_TOKEN_SECRET') ?? serviceRoleKey
  const collaboratorSecret = Deno.env.get('RESUME_COMMENT_COLLABORATOR_SECRET') ?? tokenSecret
  const anonymousPepper = Deno.env.get('RESUME_COMMENT_ANONYMOUS_PEPPER') ?? tokenSecret
  const realtimeSecret = Deno.env.get('RESUME_COMMENT_REALTIME_SECRET') ?? tokenSecret
  const admin = createAdminClient(supabaseUrl, serviceRoleKey)
  adminForMetrics = admin

  try {
    const value = await req.json().catch(() => null)
    const op = readCommentOp(value)
    operation = op
    if (!isRecord(value)) {
      throw new CommentApiError('not_found', '请求无效', 400)
    }
    const body = value
    const authStartedAt = performance.now()
    const { userId, authMode } = await authenticateSupabaseUser({
      request: req,
      client: admin,
      supabaseUrl,
    })
    const authTimingName: BootstrapTimingName = authMode === 'anonymous'
      ? 'auth_anonymous'
      : authMode === 'local_jwks'
        ? 'auth_local'
        : 'auth_legacy'
    recordTiming(authTimingName, performance.now() - authStartedAt)
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

    if (op === 'bootstrap_scope') {
      const bootstrapInput = await timeOperation('access_token', () => (
        buildBootstrapInput({
          userId,
          body,
          tokenSecret,
          collaboratorSecret,
          anonymousPepper,
        })
      ))
      await timeOperation('access_token', () => (
        assertCollaboratorBootstrapLease(admin, bootstrapInput.collaboratorLease)
      ))
      let rpcInput = bootstrapInput.rpcInput
      let repaired = false
      let result = await timeOperation('rpc', () => (
        bootstrapResumeComments(admin, rpcInput, bootstrapInput.collaboratorLease)
      ))
      await timeOperation('access_token', () => (
        assertCurrentSharePasswordGeneration({
          result,
          input: rpcInput,
          tokenSecret: bootstrapInput.shareTokenSecret,
        })
      ))
      if (
        result.status === 'scope_missing'
        && !repaired
        && (rpcInput.p_access_kind === 'owner' || rpcInput.p_access_kind === 'share')
      ) {
        const repairEnvelope = result.repair
        const canonicalScopeId = await timeOperation('repair', () => (
          repairBootstrapScope(admin, repairEnvelope)
        ))
        repaired = true
        if (rpcInput.p_access_kind === 'share') {
          rpcInput = { ...rpcInput, p_scope_id: canonicalScopeId }
        }
        result = await timeOperation('rpc', () => (
          bootstrapResumeComments(admin, rpcInput, bootstrapInput.collaboratorLease)
        ))
        await timeOperation('access_token', () => (
          assertCurrentSharePasswordGeneration({
            result,
            input: rpcInput,
            tokenSecret: bootstrapInput.shareTokenSecret,
          })
        ))
      }
      if (result.status !== 'ok')
        return bootstrapProtocolError('scope_missing_after_repair')
      const realtime = await timeOperation('realtime_token', () => issueTopics({
        access: {
          kind: result.access.kind,
          scope: { id: result.bootstrap.scope.id },
          userId: result.access.userId,
          versionId: result.access.versionId,
        },
        realtimeSecret,
        tokenSecret,
      }))
      const bootstrapResponse = json({
        ok: true,
        protocolVersion: 1,
        meta: { authMode, repair: repaired, coldStart },
        data: { ...result.bootstrap, ...realtime },
        eventSeq: result.eventSeq,
      })
      bootstrapResponse.headers.set('X-Comment-Auth-Mode', authMode)
      bootstrapResponse.headers.set('X-Comment-Scope-Repair', String(repaired))
      return finalize(bootstrapResponse)
    }

    const access = await resolveAccess({
      userId,
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
      return finalize(success({
        threads,
        profiles,
        events: projectCommentEventsForAccess(eventResult.data ?? [], access),
      }, latestScope.next_event_seq))
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
      return finalize(success({
        threads,
        profiles,
        events: projectCommentEventsForAccess(events, access),
      }, latestScope.next_event_seq))
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
        if (!isRecord(replay))
          throw new CommentApiError('unexpected', '评论文档同步响应无效', 500)
        const eventSeq = Number(replay.eventSeq)
        const [{ threads, profiles }, counts] = await Promise.all([
          loadThreads(admin, access.scope.id),
          loadThreadCounts(admin, access.scope.id),
        ])
        return finalize(success({
          ...replay,
          threads,
          profiles,
          counts,
          event: {
            event_seq: eventSeq,
            thread_id: null,
            type: 'document_synced',
            created_at: new Date().toISOString(),
            is_own: true,
          },
        }, eventSeq))
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
        type: resolveCommentEventType(op),
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
          is_own: true,
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

    if (op === 'mark_thread_read') {
      if (replay) {
        if (!isRecord(replay))
          throw new CommentApiError('unexpected', '评论已读响应无效', 500)
        return finalize(success(replay, Number(replay.eventSeq)))
      }
      const threadId = readUuid(body, 'threadId')
      const eventSeq = readNonNegativeInteger(body, 'eventSeq')
      const { data, error } = await admin.rpc('mark_resume_comment_thread_read_v1', {
        p_scope_id: access.scope.id,
        p_thread_id: threadId,
        p_actor_kind: access.actorKind,
        p_actor_id: access.actorId,
        p_actor_key: access.actorKey,
        p_request_id: requestId,
        p_event_seq: eventSeq,
      })
      if (error)
        throw error
      return finalize(success(data, Number(data.eventSeq)))
    }

    let data: Record<string, unknown>
    if (replay) {
      if (!isRecord(replay))
        throw new CommentApiError('unexpected', '评论重试响应无效', 500)
      data = replay
    }
    else {
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
      const result = await admin.rpc('execute_resume_version_comment_write', {
        p_op: op,
        p_scope_id: access.scope.id,
        p_actor_kind: access.actorKind,
        p_actor_id: access.actorId,
        p_actor_key: access.actorKey,
        p_request_id: requestId,
        p_payload: payload,
      })
      if (result.error)
        throw result.error
      if (!isRecord(result.data))
        throw new CommentApiError('unexpected', '评论响应无效', 500)
      data = result.data
      if (op !== 'mark_read') {
        scheduleBackground(notifyWrite({
          admin,
          access,
          realtimeSecret,
          eventSeq: Number(data.eventSeq),
          type: resolveCommentEventType(op),
        }))
      }
    }
    const eventSeq = Number(data.eventSeq)
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
        type: resolveCommentEventType(op),
        created_at: new Date().toISOString(),
        is_own: true,
      },
    }, eventSeq))
  }
  catch (error) {
    if (error instanceof SupabaseAuthenticationError) {
      return finalize(failure(new CommentApiError('unauthorized', '登录凭证无效', 401)))
    }
    if (error instanceof BootstrapInternalError) {
      const response = failure(
        new CommentApiError('unexpected', '评论服务暂时不可用', 500),
      )
      responseErrorCode = error.category === 'scope_repair_failed'
        ? 'database_conflict'
        : 'database_unexpected'
      return finalize(response)
    }
    responseSqlState = isRecord(error) && typeof error.code === 'string'
      && /^[0-9A-Z]{5}$/u.test(error.code)
      ? error.code
      : undefined
    const mapped = mapDatabaseError(error)
    const response = failure(mapped)
    if (mapped.code === 'unexpected')
      responseErrorCode = responseSqlState ? 'database_unexpected' : 'unexpected'
    return finalize(response)
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
