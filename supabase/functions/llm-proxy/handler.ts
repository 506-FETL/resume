import { createRequestContext } from '../shared/request-context.ts'
import {
  FUNCTION_NAME,
  OPERATION,
  MAX_BODY_BYTES,
  UPSTREAM_TIMEOUT_MS,
  DEEPSEEK_URL,
} from './constants.ts'
import { corsPreflightResponse, isOriginAllowed } from '../shared/cors.ts'
import { createAdminClient } from './client.ts'
import { createQuotaLedger, quotaHeaders } from './ledger.ts'
import type { ReservationResult } from './types.ts'
import {
  authenticateSupabaseUser,
  SupabaseAuthenticationError,
} from '../shared/supabase-auth.ts'
import { validateRequest, buildUpstreamBody } from './request.ts'
import { computeCost } from './pricing.ts'
import { readSqlState } from './values.ts'
import { classifyUpstreamFailure } from './core.ts'
import { createCompleteResponse } from './complete-response.ts'
import { createStreamingResponse } from './streaming-response.ts'

export async function handleLLMRequest(request: Request) {
  const context = createRequestContext(request, FUNCTION_NAME, 'allowlist')

  if (request.method === 'OPTIONS') {
    const response = corsPreflightResponse(request, 'allowlist')

    response.headers.set('X-Request-Id', context.requestId)

    return response
  }
  if (!isOriginAllowed(request, 'allowlist')) {
    context.log({
      level: 'warn',
      event: 'request_rejected',
      operation: OPERATION,
      status: 403,
      errorCode: 'origin_forbidden',
    })

    return context.json({ error: 'origin_forbidden' }, 403)
  }
  if (request.method !== 'POST')
    return context.json({ error: 'not_found' }, 404)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const apiKey = Deno.env.get('OPENAI_API_KEY')

  if (!supabaseUrl || !serviceRoleKey || !apiKey) {
    context.log({
      level: 'error',
      event: 'request_failed',
      operation: OPERATION,
      status: 500,
      errorCode: 'service_not_configured',
    })

    return context.json({ error: 'service_not_configured' }, 500)
  }

  const admin = createAdminClient(supabaseUrl, serviceRoleKey)

  const ledger = createQuotaLedger(admin, context)
  const { record, release } = ledger
  let userId: string | null = null
  let reservation: ReservationResult = {}
  let upstreamController: AbortController | null = null

  try {
    const identity = await authenticateSupabaseUser({
      request,
      client: admin,
      supabaseUrl,
    })

    userId = identity.userId
    ledger.userId = userId

    if (!userId) throw new SupabaseAuthenticationError()

    const rawBody = await request.text()

    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      record('client_error', 413, 'payload_too_large')

      return context.json({ error: 'payload_too_large' }, 413)
    }

    let value: unknown

    try {
      value = JSON.parse(rawBody)
    } catch {
      record('client_error', 400, 'invalid_request')

      return context.json({ error: 'invalid_request' }, 400)
    }

    const validated = validateRequest(value)

    if (!validated.ok) {
      record('client_error', 400, validated.code)

      return context.json({ error: validated.code }, 400)
    }

    const { cost, action } = computeCost(validated.messages)

    const reserveResult = await admin.rpc('reserve_ai_credits', {
      p_user_id: userId,
      p_request_id: context.requestId,
      p_weight: cost,
      p_action: action,
    })

    if (reserveResult.error) {
      const sqlState = readSqlState(reserveResult.error)

      context.log({
        level: 'error',
        event: 'quota_reservation_failed',
        operation: OPERATION,
        status: 503,
        errorCode: 'quota_reservation_failed',
        sqlState,
        authMode: identity.authMode,
      })

      record('server_error', 503, 'quota_reservation_failed', sqlState)

      return context.json({ error: 'quota_reservation_failed' }, 503)
    }

    reservation = (reserveResult.data ?? {}) as ReservationResult

    const reservationHeaders = quotaHeaders(reservation)

    if (!reservation.ok) {
      const errorCode = reservation.error ?? 'quota_reservation_failed'
      const status = errorCode === 'quota_exceeded' ? 403 : 409

      record('client_error', status, errorCode)

      return context.json(
        {
          error: errorCode,
          remaining: reservation.remaining ?? 0,
          daily_limit: reservation.daily_limit ?? 0,
          reset_at: reservation.reset_at ?? null,
        },
        status,
        reservationHeaders,
      )
    }

    upstreamController = new AbortController()

    const abortUpstream = () => upstreamController?.abort('client_cancelled')

    request.signal.addEventListener('abort', abortUpstream, { once: true })

    let upstreamTimedOut = false

    const timeoutId = setTimeout(() => {
      upstreamTimedOut = true
      upstreamController?.abort('upstream_timeout')
    }, UPSTREAM_TIMEOUT_MS)

    let upstream: Response

    try {
      upstream = await fetch(DEEPSEEK_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'X-Request-Id': context.requestId,
        },
        body: JSON.stringify(buildUpstreamBody(validated)),
        signal: upstreamController.signal,
      })
    } catch {
      clearTimeout(timeoutId)
      request.signal.removeEventListener('abort', abortUpstream)

      await release(
        upstreamTimedOut ? 'upstream_timeout' : 'upstream_fetch_failed',
      )

      const errorCode = upstreamTimedOut
        ? 'upstream_timeout'
        : 'upstream_unavailable'

      record('server_error', 503, errorCode)

      return context.json({ error: errorCode }, 503, reservationHeaders)
    }

    if (!upstream.ok) {
      clearTimeout(timeoutId)
      request.signal.removeEventListener('abort', abortUpstream)

      const mapped = classifyUpstreamFailure(upstream.status)

      await release(mapped.failure)

      context.log({
        level:
          upstream.status >= 500 || upstream.status === 402 ? 'error' : 'warn',
        event: 'upstream_failed',
        operation: OPERATION,
        status: mapped.status,
        errorCode: mapped.code,
        upstreamStatus: upstream.status,
        authMode: identity.authMode,
      })

      record(
        mapped.status >= 500 ? 'server_error' : 'client_error',
        mapped.status,
        mapped.code,
      )

      return context.json(
        { error: mapped.code },
        mapped.status,
        reservationHeaders,
      )
    }

    if (!upstream.body) {
      clearTimeout(timeoutId)
      request.signal.removeEventListener('abort', abortUpstream)
      await release('upstream_empty_body')
      record('server_error', 503, 'upstream_unavailable')

      return context.json(
        { error: 'upstream_unavailable' },
        503,
        reservationHeaders,
      )
    }

    const cleanupUpstream = () => {
      clearTimeout(timeoutId)
      request.signal.removeEventListener('abort', abortUpstream)
    }

    if (!validated.stream)
      return await createCompleteResponse({
        upstream,
        admin,
        userId,
        context,
        reservationHeaders,
        ledger,
        cleanupUpstream,
      })

    return createStreamingResponse({
      body: upstream.body,
      upstreamController,
      admin,
      userId,
      context,
      reservationHeaders,
      ledger,
      cleanupUpstream,
    })
  } catch (error) {
    upstreamController?.abort()

    if (error instanceof SupabaseAuthenticationError) {
      context.log({
        level: 'warn',
        event: 'request_rejected',
        operation: OPERATION,
        status: 401,
        errorCode: 'auth_invalid',
      })

      record('client_error', 401, 'auth_invalid')

      return context.json({ error: 'auth_invalid' }, 401)
    }

    if (reservation.ok) await release('unexpected')

    const sqlState = readSqlState(error)

    context.log({
      level: 'error',
      event: 'request_failed',
      operation: OPERATION,
      status: 500,
      errorCode: 'unexpected',
      sqlState,
    })

    record('server_error', 500, 'unexpected', sqlState)

    return context.json({ error: 'unexpected' }, 500, quotaHeaders(reservation))
  }
}
