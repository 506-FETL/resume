import { createCommentResponses } from './response.ts'
import { corsPreflightResponse, isOriginAllowed } from '../shared/cors.ts'
import {
  CommentApiError,
  readCommentOp,
  isRecord,
  readRequiredString,
} from '../shared/resume-comment-schema.ts'
import { createAdminClient } from './client.ts'
import { verifyCommentToken } from '../shared/resume-comment-auth.ts'
import { canReadShareComments } from '../shared/resume-share-privacy.ts'
import {
  authenticateSupabaseUser,
  SupabaseAuthenticationError,
} from '../shared/supabase-auth.ts'
import type { BootstrapTimingName } from './bootstrap-types.ts'
import { handleCollaborationSessionOperation } from './collaboration-operations.ts'
import { handleBootstrapScope } from './bootstrap-operation.ts'
import { buildBootstrapInput } from './bootstrap-input.ts'
import {
  resolveCommentAccessRpc,
  assertResolvedSharePasswordGeneration,
} from './bootstrap-rpc.ts'
import { createAnonymousCommentIdentity } from './anonymous-identity.ts'
import { listCommentEvents, issueTopics } from './events.ts'
import { syncCommentDocument } from './document-sync.ts'
import { executeCommentMutation } from './mutations.ts'
import { BootstrapInternalError } from './bootstrap-errors.ts'
import { mapDatabaseError } from './write-payload.ts'

export async function handleCommentRequest(req: Request) {
  const responses = createCommentResponses(req)

  const {
    context,
    requestId,
    coldStart,
    recordTiming,
    timeOperation,
    finalize,
    json,
    success,
    failure,
  } = responses

  if (req.method === 'OPTIONS') {
    const response = corsPreflightResponse(req, 'allowlist')

    response.headers.set('X-Request-Id', requestId)

    return response
  }
  if (!isOriginAllowed(req, 'allowlist')) {
    context.log({
      level: 'warn',
      event: 'request_rejected',
      operation: responses.operation,
      status: 403,
      errorCode: 'origin_forbidden',
    })

    return context.json({ error: 'origin_forbidden' }, 403)
  }
  if (req.method !== 'POST') {
    return finalize(
      failure(new CommentApiError('not_found', '接口不存在', 404)),
    )
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    context.log({
      level: 'error',
      event: 'request_failed',
      operation: responses.operation,
      status: 500,
      errorCode: 'service_not_configured',
    })

    return finalize(
      failure(new CommentApiError('unexpected', '评论服务暂时不可用', 500)),
    )
  }

  const tokenSecret =
    Deno.env.get('RESUME_COMMENT_TOKEN_SECRET') ?? serviceRoleKey

  const collaboratorSecret =
    Deno.env.get('RESUME_COMMENT_COLLABORATOR_SECRET') ?? tokenSecret

  const anonymousPepper =
    Deno.env.get('RESUME_COMMENT_ANONYMOUS_PEPPER') ?? tokenSecret

  const realtimeSecret =
    Deno.env.get('RESUME_COMMENT_REALTIME_SECRET') ?? tokenSecret

  const admin = createAdminClient(supabaseUrl, serviceRoleKey)

  responses.adminForMetrics = admin

  try {
    const value = await req.json().catch(() => null)
    const op = readCommentOp(value)

    responses.operation = op

    if (!isRecord(value)) {
      throw new CommentApiError('not_found', '请求无效', 400)
    }

    const body = value

    if (body.accessKind === 'share') {
      const shareToken = await verifyCommentToken(
        readRequiredString(body, 'accessToken', 4_096),
        'share',
        tokenSecret,
      )

      const { data: privacy, error: privacyError } = await admin
        .from('resume_shares')
        .select('purpose,show_phone,show_email')
        .eq('id', shareToken.shareId)
        .maybeSingle()

      if (privacyError) throw privacyError
      if (!privacy || !canReadShareComments(privacy))
        throw new CommentApiError(
          'share_unavailable',
          '此分享不公开评论和附件',
          404,
        )
    }

    const authStartedAt = performance.now()

    const { userId, authMode } = await authenticateSupabaseUser({
      request: req,
      client: admin,
      supabaseUrl,
    })

    const authTimingName: BootstrapTimingName =
      authMode === 'anonymous'
        ? 'auth_anonymous'
        : authMode === 'local_jwks'
          ? 'auth_local'
          : 'auth_legacy'

    recordTiming(authTimingName, performance.now() - authStartedAt)

    if (
      op === 'register_collaboration_session' ||
      op === 'join_collaboration_session' ||
      op === 'renew_collaboration_session' ||
      op === 'leave_collaboration_session'
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
      return finalize(
        await handleBootstrapScope({
          admin,
          userId,
          body,
          tokenSecret,
          collaboratorSecret,
          anonymousPepper,
          realtimeSecret,
          timeOperation,
          json,
          coldStart,
          authMode,
        }),
      )
    }

    const accessInput = await timeOperation('access_token', () =>
      buildBootstrapInput({
        userId,
        body,
        tokenSecret,
        collaboratorSecret,
        anonymousPepper,
      }),
    )

    const resolvedAccess = await timeOperation('access_rpc', () =>
      resolveCommentAccessRpc(
        admin,
        accessInput.rpcInput,
        accessInput.collaboratorLease,
      ),
    )

    await timeOperation('access_token', () =>
      assertResolvedSharePasswordGeneration({
        input: accessInput.rpcInput,
        sharePasswordHash: resolvedAccess.sharePasswordHash,
        tokenSecret: accessInput.shareTokenSecret,
      }),
    )

    const access = resolvedAccess.access

    if (op === 'create_anonymous_identity') {
      return finalize(
        await createAnonymousCommentIdentity({
          req,
          admin,
          body,
          access,
          anonymousPepper,
          success,
        }),
      )
    }

    if (op === 'list_threads' || op === 'list_events') {
      return finalize(
        await listCommentEvents({ admin, body, access, op, success }),
      )
    }

    if (op === 'issue_realtime_token') {
      const realtime = await issueTopics({
        access,
        realtimeSecret,
        tokenSecret,
      })

      return finalize(success(realtime, access.scope.next_event_seq))
    }

    if (op === 'sync_working_document') {
      return finalize(
        await syncCommentDocument({
          req,
          admin,
          body,
          access,
          op,
          anonymousPepper,
          realtimeSecret,
          success,
        }),
      )
    }

    return finalize(
      await executeCommentMutation({
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
      }),
    )
  } catch (error) {
    if (error instanceof SupabaseAuthenticationError) {
      return finalize(
        failure(new CommentApiError('unauthorized', '登录凭证无效', 401)),
      )
    }
    if (error instanceof BootstrapInternalError) {
      const response = failure(
        new CommentApiError('unexpected', '评论服务暂时不可用', 500),
      )

      responses.responseErrorCode =
        error.category === 'scope_repair_failed'
          ? 'database_conflict'
          : 'database_unexpected'

      return finalize(response)
    }

    responses.responseSqlState =
      isRecord(error) &&
      typeof error.code === 'string' &&
      /^[0-9A-Z]{5}$/u.test(error.code)
        ? error.code
        : undefined

    const mapped = mapDatabaseError(error)
    const response = failure(mapped)

    if (mapped.code === 'unexpected')
      responses.responseErrorCode = responses.responseSqlState
        ? 'database_unexpected'
        : 'unexpected'

    return finalize(response)
  }
}
