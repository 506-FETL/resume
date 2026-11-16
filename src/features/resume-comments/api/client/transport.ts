import { getDatabaseFunctionUrl } from '@/lib/supabase/edge-functions'
import type { CommentErrorCode } from '../../types.ts'
import { getCommentAuthToken } from './auth-token'
import { ResumeCommentClientError } from './error'
import { readBootstrapTelemetry } from './normalize-responses'
import type {
  CommentAccessContext,
  CommentApiSuccess,
  CommentBootstrapClientStage,
} from './types'
import { asNumber, asRecord, isUuid } from './values'

export function buildCommentAccessBody(
  access: CommentAccessContext,
  resolvedOwnerScopeId: string | null,
): Record<string, unknown> {
  if (access.kind === 'owner') {
    return {
      accessKind: 'owner',
      ...(resolvedOwnerScopeId
        ? { scopeId: resolvedOwnerScopeId }
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

export async function requestComment<T>(
  access: CommentAccessContext,
  resolvedOwnerScopeId: string | null,
  op: string,
  input: Record<string, unknown> = {},
): Promise<CommentApiSuccess<T>> {
  // 请求入口同步冻结作用域；鉴权等待期间切换版本时，旧请求不能借用新 access。
  const accessBody = buildCommentAccessBody(access, resolvedOwnerScopeId)

  const clientDurations: Partial<Record<CommentBootstrapClientStage, number>> =
    {}

  const authStartedAt = performance.now()
  const authToken = await getCommentAuthToken()

  clientDurations.auth_token = performance.now() - authStartedAt

  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

  const requestId = isUuid(input.requestId)
    ? input.requestId
    : crypto.randomUUID()

  const url = getDatabaseFunctionUrl('resume-comments')

  const requestHeaders = {
    'Content-Type': 'application/json',
    apikey: publishableKey,
    Authorization: `Bearer ${authToken ?? publishableKey}`,
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

  const response = await fetch(url, {
    method: 'POST',
    headers: requestHeaders,
    body: requestBody,
  }).catch(() => {
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
  } catch {
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
      error.retryAfterSeconds == null
        ? undefined
        : asNumber(error.retryAfterSeconds),
      responseRequestId,
      error.details,
    )
  }

  const hasTelemetryEnvelope =
    result.protocolVersion === 1 &&
    Object.keys(asRecord(result.meta)).length > 0

  const telemetry =
    op === 'bootstrap_scope' || hasTelemetryEnvelope
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
