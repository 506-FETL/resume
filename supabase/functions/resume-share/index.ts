/* global Deno */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.103.0'
import { corsPreflightResponse } from '../shared/cors.ts'
import { recordOperationMetric, scheduleBackground } from '../shared/operation-metrics.ts'
import { createRequestContext } from '../shared/request-context.ts'
import {
  derivePasswordGeneration,
  signCommentToken,
} from '../shared/resume-comment-auth.ts'
import { buildCommentAnchorDocument } from '../shared/resume-comment-core.ts'
import {
  broadcastCommentInvalidation,
  deriveOwnerRealtimeTopic,
  deriveScopeRealtimeTopic,
} from '../shared/resume-comment-events.ts'
import {
  authenticateSupabaseUser,
  SupabaseAuthenticationError,
} from '../shared/supabase-auth.ts'

const PASSWORD_ALGORITHM = 'pbkdf2-sha256'
const PASSWORD_ITERATIONS = 310_000
const PASSWORD_KEY_LENGTH = 32
const PASSWORD_SALT_LENGTH = 16

interface GetResult {
  needPassword?: boolean
  snapshot?: unknown
  template_manifest?: unknown
  display_name?: string | null
  share_id?: string
  release_id?: string
  release_no?: number
  version_id?: number
  document_revision?: number
  allow_comments?: boolean
  projection_reference_date?: string
  comment_scope_id?: string
  comment_access_token?: string
  comment_access_expires_at?: string
  error?: string
}

interface CurrentReleaseRow {
  id: string
  release_no: number
  snapshot: unknown
  template_manifest: unknown
  display_name: string | null
  created_at: string
}

interface SharedVersionRow {
  id: number
  resume_id: string
  user_id: string
  snapshot: unknown
  status: 'active' | 'frozen'
  document_revision: number
  projection_reference_date: string
}

function createAdminClient(url: string, serviceRoleKey: string) {
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

type AdminClient = ReturnType<typeof createAdminClient>

function readCurrentRelease(value: unknown): CurrentReleaseRow | null {
  const release = (Array.isArray(value) ? value[0] : value) as CurrentReleaseRow | null
  return release?.id && Number.isInteger(release.release_no) ? release : null
}

function getClientAddress(req: Request) {
  return req.headers.get('cf-connecting-ip')
    ?? req.headers.get('x-real-ip')
    ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? 'unknown'
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes)
    binary += String.fromCharCode(byte)
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function base64UrlToBytes(value: string) {
  const base64 = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=')
  const binary = atob(base64)
  return Uint8Array.from(binary, character => character.charCodeAt(0))
}

async function derivePasswordKey(password: string, salt: Uint8Array, iterations: number) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations,
    },
    keyMaterial,
    PASSWORD_KEY_LENGTH * 8,
  )
  return new Uint8Array(bits)
}

async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(PASSWORD_SALT_LENGTH))
  const digest = await derivePasswordKey(password, salt, PASSWORD_ITERATIONS)
  return [
    PASSWORD_ALGORITHM,
    PASSWORD_ITERATIONS,
    bytesToBase64Url(salt),
    bytesToBase64Url(digest),
  ].join('$')
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length)
    return false

  let difference = 0
  for (let index = 0; index < left.length; index += 1)
    difference |= left[index] ^ right[index]
  return difference === 0
}

async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, iterationsValue, saltValue, digestValue] = storedHash.split('$')
  const iterations = Number(iterationsValue)
  if (
    algorithm !== PASSWORD_ALGORITHM
    || !Number.isInteger(iterations)
    || iterations < 100_000
    || iterations > 1_000_000
    || !saltValue
    || !digestValue
  ) {
    return false
  }

  const salt = base64UrlToBytes(saltValue)
  const expectedDigest = base64UrlToBytes(digestValue)
  const actualDigest = await derivePasswordKey(password, salt, iterations)
  return timingSafeEqual(actualDigest, expectedDigest)
}

async function verifyShareOwnership(
  admin: AdminClient,
  shareId: string,
  userId: string,
) {
  const { data, error } = await admin
    .from('resume_shares')
    .select('id')
    .eq('id', shareId)
    .eq('user_id', userId)
    .maybeSingle()
  return !error && Boolean(data)
}

async function consumeOwnerWriteLimit(
  admin: AdminClient,
  userId: string,
) {
  const { data, error } = await admin.rpc('consume_resume_share_owner_write', {
    p_user_id: userId,
    p_limit: 30,
    p_window_seconds: 60,
    p_block_seconds: 60,
  })
  return !error && Boolean(data)
}

async function ensureShareCommentScope(
  admin: AdminClient,
  version: SharedVersionRow,
) {
  const { data: existing, error: existingError } = await admin
    .from('resume_comment_scopes')
    .select('id,projection_reference_date')
    .eq('kind', 'version')
    .eq('version_id', version.id)
    .is('archived_at', null)
    .maybeSingle()
  if (existingError) {
    throw existingError
  }
  if (existing?.id) {
    return {
      id: existing.id as string,
      projectionReferenceDate: String(existing.projection_reference_date),
    }
  }

  const referenceDate = version.projection_reference_date
  const { document, documentHash } = buildCommentAnchorDocument(
    version.snapshot,
    referenceDate,
  )
  const { data, error } = await admin.rpc('ensure_resume_version_comment_scope', {
    p_owner_user_id: version.user_id,
    p_version_id: version.id,
    p_anchor_document: document,
    p_document_hash: documentHash,
    p_projection_reference_date: referenceDate,
    p_expected_document_revision: version.document_revision,
  })
  if (error || typeof data !== 'string')
    throw error ?? new Error('Unable to ensure version comment scope')
  return { id: data, projectionReferenceDate: referenceDate }
}

async function notifyShareCommentSettings({
  admin,
  shareId,
  userId,
  allowComments,
  realtimeSecret,
}: {
  admin: AdminClient
  shareId: string
  userId: string
  allowComments: boolean
  realtimeSecret: string
}) {
  const { data: share, error: shareError } = await admin
    .from('resume_shares')
    .select('current_release_id,version_id')
    .eq('id', shareId)
    .eq('user_id', userId)
    .single()
  if (shareError || !share.current_release_id || !share.version_id)
    throw shareError ?? new Error('Current share release not found')

  const { data: scope, error: scopeError } = await admin
    .from('resume_comment_scopes')
    .select('id')
    .eq('kind', 'version')
    .eq('version_id', share.version_id)
    .is('archived_at', null)
    .single()
  if (scopeError)
    throw scopeError

  const { data: eventSeqValue, error: eventError } = await admin.rpc(
    'append_resume_comment_event',
    {
      p_scope_id: scope.id,
      p_thread_id: null,
      p_type: 'settings_changed',
      p_actor_kind: 'user',
      p_actor_id: userId,
      p_payload: { allowComments },
    },
  )
  if (eventError)
    throw eventError

  const topics = await Promise.all([
    deriveScopeRealtimeTopic({
      scopeId: scope.id,
      versionId: share.version_id,
      secret: realtimeSecret,
    }),
    deriveOwnerRealtimeTopic({ userId, secret: realtimeSecret }),
  ])
  await broadcastCommentInvalidation({
    admin,
    topics: topics.map(item => item.topic),
    eventSeq: Number(eventSeqValue),
    type: 'settings_changed',
  })
}

Deno.serve(async (req) => {
  const context = createRequestContext(req, 'resume-share', 'public')
  if (req.method === 'OPTIONS') {
    const response = corsPreflightResponse(req, 'public')
    response.headers.set('X-Request-Id', context.requestId)
    return response
  }
  if (req.method !== 'GET' && req.method !== 'POST') {
    return context.json({ error: 'method_not_allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    context.log({
      level: 'error',
      event: 'request_failed',
      operation: 'share_access',
      status: 500,
      errorCode: 'service_not_configured',
    })
    return context.json({ error: 'service_not_configured' }, 500)
  }
  const admin = createAdminClient(supabaseUrl, serviceRoleKey)
  let operation = 'share_access'
  const json = (body: unknown, status = 200, metricErrorCode?: string) => {
    const responseErrorCode = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
      ? body.error
      : undefined
    const errorCode = metricErrorCode ?? responseErrorCode
    const outcome = status >= 500
      ? 'server_error' as const
      : status >= 400
        ? 'client_error' as const
        : 'success' as const
    scheduleBackground(recordOperationMetric(admin, {
      requestId: context.requestId,
      functionName: 'resume-share',
      operation,
      outcome,
      errorCode,
      status,
      durationMs: context.durationMs(),
    }), 'operation_metric_failed')
    if (status >= 500) {
      context.log({
        level: 'error',
        event: 'request_failed',
        operation,
        status,
        errorCode: errorCode ?? 'unexpected',
      })
    }
    return context.json(body, status, {
      'Server-Timing': `edge_total;dur=${context.durationMs().toFixed(1)}`,
    })
  }
  // 统一「不可用」文案：不区分不存在、关闭或过期，降低探测。
  const unavailable = () => json({ error: 'unavailable' }, 404, 'share_unavailable')

  try {
    // ============ 匿名读取：GET ?token / POST { token, password }（读取意图） ============
    // POST 且带 op 字段 → owner 写入；否则视为访问读取。
    const url = new URL(req.url)
    let token = url.searchParams.get('token') ?? ''
    let password: string | null = null
    let passwordProvided = false
    let op: string | null = null
    let shareId: string | null = null
    let label: string | null = null
    let expiresAt: string | null = null
    let allowComments: boolean | undefined
    let refreshOnly = false

    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({})) as Record<string, unknown>
      op = typeof body.op === 'string' ? body.op : null
      operation = op === 'set_password' || op === 'update_settings'
        ? 'owner_write'
        : 'share_access'
      if (typeof body.token === 'string')
        token = body.token
      if (Object.hasOwn(body, 'password')) {
        passwordProvided = true
        if (typeof body.password === 'string')
          password = body.password
      }
      if (typeof body.shareId === 'string')
        shareId = body.shareId
      if (typeof body.label === 'string')
        label = body.label
      if (typeof body.expiresAt === 'string')
        expiresAt = body.expiresAt
      if (typeof body.allowComments === 'boolean')
        allowComments = body.allowComments
      refreshOnly = body.refresh === true
    }

    // ============ owner 密码写入分支 ============
    // 用 body.shareId 定位（不复用 token），带 owner JWT 鉴权。
    // 明文密码有值 → PBKDF2-SHA256 hash 写入 password_hash；清除密码 → 写 null。
    if (op === 'set_password') {
      const { userId } = await authenticateSupabaseUser({
        request: req,
        client: admin,
        supabaseUrl,
      })
      if (!userId)
        return json({ error: 'unauthorized' }, 401)
      if (!shareId)
        return json({ error: 'missing shareId' }, 400)
      if (password && password.length > 128)
        return json({ error: 'password_too_long' }, 400)
      if (!await verifyShareOwnership(admin, shareId, userId))
        return json({ error: 'not_found' }, 404)
      if (!await consumeOwnerWriteLimit(admin, userId))
        return json({ error: 'rate_limited' }, 429)

      let nextHash: string | null = null
      try {
        nextHash = password ? await hashPassword(password) : null
      }
      catch {
        context.log({
          level: 'error',
          event: 'password_hash_failed',
          operation,
          status: 500,
          errorCode: 'unexpected',
        })
        return json({ error: 'unexpected' }, 500)
      }
      const { error, count } = await admin
        .from('resume_shares')
        .update({ password_hash: nextHash }, { count: 'exact' })
        .eq('id', shareId)
        .eq('user_id', userId)
      if (error) {
        context.log({
          level: 'error',
          event: 'database_write_failed',
          operation,
          status: 500,
          errorCode: 'database_unexpected',
          sqlState: error.code,
        })
        return json({ error: 'unexpected' }, 500)
      }
      if (!count)
        return json({ error: 'not_found' }, 404)
      return json({ ok: true })
    }

    if (op === 'update_settings') {
      const { userId } = await authenticateSupabaseUser({
        request: req,
        client: admin,
        supabaseUrl,
      })
      if (!userId)
        return json({ error: 'unauthorized' }, 401)
      if (!shareId)
        return json({ error: 'missing shareId' }, 400)
      if (label && label.length > 120)
        return json({ error: 'label_too_long' }, 400)
      if (password && password.length > 128)
        return json({ error: 'password_too_long' }, 400)
      if (expiresAt && Number.isNaN(new Date(expiresAt).getTime()))
        return json({ error: 'invalid_expiry' }, 400)
      if (!await verifyShareOwnership(admin, shareId, userId))
        return json({ error: 'not_found' }, 404)
      if (!await consumeOwnerWriteLimit(admin, userId))
        return json({ error: 'rate_limited' }, 429)

      const patch: Record<string, unknown> = {
        label,
        expires_at: expiresAt,
        ...(allowComments === undefined ? {} : { allow_comments: allowComments }),
      }
      if (passwordProvided) {
        try {
          patch.password_hash = password ? await hashPassword(password) : null
        }
        catch {
          context.log({
            level: 'error',
            event: 'password_hash_failed',
            operation,
            status: 500,
            errorCode: 'unexpected',
          })
          return json({ error: 'unexpected' }, 500)
        }
      }

      const { error, count } = await admin
        .from('resume_shares')
        .update(patch, { count: 'exact' })
        .eq('id', shareId)
        .eq('user_id', userId)
      if (error) {
        context.log({
          level: 'error',
          event: 'database_write_failed',
          operation,
          status: 500,
          errorCode: 'database_unexpected',
          sqlState: error.code,
        })
        return json({ error: 'unexpected' }, 500)
      }
      if (!count)
        return json({ error: 'not_found' }, 404)
      if (allowComments !== undefined) {
        const realtimeSecret = Deno.env.get('RESUME_COMMENT_REALTIME_SECRET')
          ?? Deno.env.get('RESUME_COMMENT_TOKEN_SECRET')
          ?? serviceRoleKey
        try {
          await notifyShareCommentSettings({
            admin,
            shareId,
            userId,
            allowComments,
            realtimeSecret,
          })
        }
        catch {
          context.log({
            level: 'warn',
            event: 'comment_notification_failed',
            operation,
            status: 200,
            errorCode: 'database_unexpected',
          })
        }
      }
      return json({ ok: true })
    }

    // ============ 匿名读取分支 ============
    if (!token || token.length > 128)
      return unavailable()

    const { data, error } = await admin
      .from('resume_shares')
      .select(`
        id,
        is_active,
        password_hash,
        expires_at,
        archived_at,
        allow_comments,
        version_id,
        current_release_id,
        version:resume_config_versions!resume_shares_version_id_fkey(
          id,
          resume_id,
          user_id,
          snapshot,
          status,
          document_revision,
          projection_reference_date
        ),
        current_release:resume_share_releases!resume_shares_current_release_id_fkey(
          id,
          release_no,
          snapshot,
          template_manifest,
          display_name,
          created_at
        )
      `)
      .eq('token', token)
      .maybeSingle()

    if (error || !data)
      return unavailable()
    if (!data.is_active || data.archived_at)
      return unavailable()
    if (data.expires_at && new Date(data.expires_at).getTime() < Date.now())
      return unavailable()

    const currentRelease = readCurrentRelease(data.current_release)
    if (!currentRelease || currentRelease.id !== data.current_release_id)
      return unavailable()
    const version = (Array.isArray(data.version) ? data.version[0] : data.version) as SharedVersionRow | null
    if (!version || version.id !== data.version_id)
      return unavailable()

    if (data.password_hash) {
      if (!password)
        return json({ needPassword: true } satisfies GetResult)
      if (password.length > 128)
        return json({ needPassword: true, error: 'wrong_password' } satisfies GetResult)

      const clientKey = await sha256(getClientAddress(req))
      const [clientLimit, shareLimit] = await Promise.all([
        admin.rpc('consume_resume_share_password_attempt', {
          p_share_id: data.id,
          p_key_hash: clientKey,
          p_limit: 10,
          p_window_seconds: 900,
          p_block_seconds: 900,
        }),
        admin.rpc('consume_resume_share_password_attempt', {
          p_share_id: data.id,
          p_key_hash: '__share_global__',
          p_limit: 200,
          p_window_seconds: 900,
          p_block_seconds: 900,
        }),
      ])
      if (clientLimit.error || shareLimit.error)
        return json({ error: 'temporarily_unavailable' }, 503)
      if (!clientLimit.data || !shareLimit.data) {
        return json({
          needPassword: true,
          error: 'rate_limited',
        } satisfies GetResult, 429)
      }

      let ok = false
      try {
        ok = await verifyPassword(password, data.password_hash)
      }
      catch {
        context.log({
          level: 'error',
          event: 'password_verify_failed',
          operation,
          status: 503,
          errorCode: 'unexpected',
        })
        return json({ error: 'temporarily_unavailable' }, 503)
      }
      if (!ok)
        return json({ needPassword: true, error: 'wrong_password' } satisfies GetResult)

      const { error: clearError } = await admin.rpc('clear_resume_share_password_attempts', {
        p_share_id: data.id,
        p_key_hash: clientKey,
      })
      if (clearError) {
        context.log({
          level: 'warn',
          event: 'password_attempt_cleanup_failed',
          operation,
          status: 200,
          errorCode: 'database_unexpected',
          sqlState: clearError.code,
        })
      }
    }

    // 校验通过后原子记录访问；统计失败不阻断简历查看。
    if (!refreshOnly) {
      const { error: viewError } = await admin.rpc('record_resume_share_view', {
        p_share_id: data.id,
      })
      if (viewError) {
        context.log({
          level: 'warn',
          event: 'view_counter_failed',
          operation,
          status: 200,
          errorCode: 'database_unexpected',
          sqlState: viewError.code,
        })
      }
    }

    const commentTokenSecret = Deno.env.get('RESUME_COMMENT_TOKEN_SECRET') ?? serviceRoleKey
    const commentScope = await ensureShareCommentScope(admin, version)
    const issuedAt = Math.floor(Date.now() / 1_000)
    const expiresAtSeconds = issuedAt + 15 * 60
    const passwordGeneration = await derivePasswordGeneration(
      data.password_hash,
      commentTokenSecret,
    )
    const commentAccessToken = await signCommentToken({
      version: 1,
      kind: 'share',
      issuedAt,
      expiresAt: expiresAtSeconds,
      shareId: data.id,
      versionId: version.id,
      releaseId: currentRelease.id,
      scopeId: commentScope.id,
      passwordGeneration,
    }, commentTokenSecret)

    // 匿名读取只返回固化快照、模板与标题，绝不返回 password_hash / user_id 等敏感字段。
    return json({
      snapshot: currentRelease.snapshot,
      template_manifest: currentRelease.template_manifest,
      display_name: currentRelease.display_name,
      share_id: data.id,
      release_id: currentRelease.id,
      release_no: currentRelease.release_no,
      version_id: version.id,
      document_revision: version.document_revision,
      allow_comments: data.allow_comments,
      projection_reference_date: commentScope.projectionReferenceDate,
      comment_scope_id: commentScope.id,
      comment_access_token: commentAccessToken,
      comment_access_expires_at: new Date(expiresAtSeconds * 1_000).toISOString(),
    } satisfies GetResult)
  }
  catch (err) {
    if (err instanceof SupabaseAuthenticationError)
      return json({ error: 'unauthorized' }, 401)
    const sqlState = err && typeof err === 'object' && 'code' in err && typeof err.code === 'string'
      ? err.code
      : undefined
    context.log({
      level: 'error',
      event: 'request_failed',
      operation,
      status: 500,
      errorCode: 'unexpected',
      sqlState,
    })
    return json({ error: 'unexpected' }, 500)
  }
})
