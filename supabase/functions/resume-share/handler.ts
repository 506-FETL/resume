import { createRequestContext } from '../shared/request-context.ts'
import { corsPreflightResponse } from '../shared/cors.ts'
import { createAdminClient } from './client.ts'
import {
  scheduleBackground,
  recordOperationMetric,
} from '../shared/operation-metrics.ts'
import { readShareRequest } from './input.ts'
import { setSharePassword } from './owner-password.ts'
import { updateShareSettings } from './owner-settings.ts'
import { readPublicShare } from './public-read.ts'
import { SupabaseAuthenticationError } from '../shared/supabase-auth.ts'

export async function handleShareRequest(req: Request) {
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
    const responseErrorCode =
      body &&
      typeof body === 'object' &&
      'error' in body &&
      typeof body.error === 'string'
        ? body.error
        : undefined

    const errorCode = metricErrorCode ?? responseErrorCode

    const outcome =
      status >= 500
        ? ('server_error' as const)
        : status >= 400
          ? ('client_error' as const)
          : ('success' as const)

    scheduleBackground(
      recordOperationMetric(admin, {
        requestId: context.requestId,
        functionName: 'resume-share',
        operation,
        outcome,
        errorCode,
        status,
        durationMs: context.durationMs(),
      }),
      'operation_metric_failed',
    )

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
      'Cache-Control': 'no-store',
    })
  }

  // 统一「不可用」文案：不区分不存在、关闭或过期，降低探测。
  const unavailable = () =>
    json({ error: 'unavailable' }, 404, 'share_unavailable')

  try {
    const input = await readShareRequest(req)

    operation = input.operation

    if (input.op === 'set_password')
      return await setSharePassword({
        req,
        admin,
        supabaseUrl,
        context,
        json,
        input,
      })
    if (input.op === 'update_settings')
      return await updateShareSettings({
        req,
        admin,
        supabaseUrl,
        serviceRoleKey,
        context,
        json,
        input,
      })

    return await readPublicShare({
      req,
      admin,
      serviceRoleKey,
      context,
      json,
      unavailable,
      input,
    })
  } catch (err) {
    if (err instanceof SupabaseAuthenticationError)
      return json({ error: 'unauthorized' }, 401)

    const sqlState =
      err &&
      typeof err === 'object' &&
      'code' in err &&
      typeof err.code === 'string'
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
}
