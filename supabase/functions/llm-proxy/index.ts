/* global Deno */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.103.0'
import { corsPreflightResponse, isOriginAllowed } from '../shared/cors.ts'
import { recordOperationMetric, scheduleBackground } from '../shared/operation-metrics.ts'
import { createRequestContext } from '../shared/request-context.ts'
import {
  authenticateSupabaseUser,
  SupabaseAuthenticationError,
} from '../shared/supabase-auth.ts'

interface LLMProxyRequest {
  messages?: unknown
  model?: unknown
  response_format?: unknown
  temperature?: unknown
  stream?: unknown
  stream_options?: unknown
  max_tokens?: unknown
  tools?: unknown
  tool_choice?: unknown
  thinking?: unknown
  reasoning_effort?: unknown
}

interface ReservationResult {
  ok?: boolean
  error?: string
  state?: string
  remaining?: number
  daily_limit?: number
  reset_at?: string
  unlimited?: boolean
  replayed?: boolean
}

interface LedgerResult {
  ok?: boolean
  error?: string
}

interface StreamUsage {
  promptTokens: number | null
  completionTokens: number | null
  totalTokens: number | null
}

interface InspectedEvent {
  done: boolean
  meaningful: boolean
  upstreamRequestId: string | null
  finishReason: string | null
  usage: StreamUsage | null
}

const FUNCTION_NAME = 'llm-proxy'
const OPERATION = 'chat_completion'
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'
const MAX_BODY_BYTES = 1024 * 1024
const UPSTREAM_TIMEOUT_MS = 120_000
const ALLOWED_MODELS = new Set(['deepseek-v4-pro'])
const ALLOWED_ROLES = new Set(['system', 'user', 'assistant', 'tool'])
const ALLOWED_REASONING_EFFORT = new Set(['low', 'medium', 'high'])

const HEAVY_RESUME_WRITE_TOOLS = new Set<string>([
  'update_current_resume_field',
  'create_resume',
  'update_resume_meta',
  'delete_resume',
  'save_current_resume_version',
  'restore_current_resume_version',
  'delete_resume_version',
])

const ATS_SYSTEM_MARKER = 'ATS 简历评估引擎'

function createAdminClient(url: string, serviceRoleKey: string) {
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function messagesContainAtsMarker(messages: unknown[]) {
  return messages.some((raw) => {
    if (!isRecord(raw) || raw.role !== 'system')
      return false
    return typeof raw.content === 'string' && raw.content.includes(ATS_SYSTEM_MARKER)
  })
}

function computeCost(messages: unknown[]): { cost: 1 | 3, action: string } {
  if (messagesContainAtsMarker(messages))
    return { cost: 3, action: 'ats' }

  let lastUserIndex = -1
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (isRecord(message) && message.role === 'user') {
      lastUserIndex = index
      break
    }
  }
  const currentTurn = lastUserIndex >= 0
    ? messages.slice(lastUserIndex + 1)
    : messages
  const heavy = currentTurn.some((message) => {
    if (!isRecord(message) || message.role !== 'assistant' || !Array.isArray(message.tool_calls))
      return false
    return message.tool_calls.some((toolCall) => {
      if (!isRecord(toolCall) || !isRecord(toolCall.function))
        return false
      return typeof toolCall.function.name === 'string'
        && HEAVY_RESUME_WRITE_TOOLS.has(toolCall.function.name)
    })
  })
  return heavy
    ? { cost: 3, action: 'resume_op' }
    : { cost: 1, action: 'chat' }
}

function validateMessages(value: unknown): value is unknown[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 128)
    return false
  return value.every(message => (
    isRecord(message)
    && typeof message.role === 'string'
    && ALLOWED_ROLES.has(message.role)
    && ('content' in message || 'tool_calls' in message)
  ))
}

function validateTools(value: unknown) {
  if (value === undefined)
    return true
  if (!Array.isArray(value) || value.length > 64)
    return false
  return value.every((tool) => {
    if (!isRecord(tool) || tool.type !== 'function' || !isRecord(tool.function))
      return false
    const name = tool.function.name
    return typeof name === 'string'
      && /^\w[\w-]{0,63}$/u.test(name)
      && JSON.stringify(tool).length <= 32_768
  })
}

function validateRequest(value: unknown) {
  if (!isRecord(value))
    return { ok: false as const, code: 'invalid_request' }
  const request = value as LLMProxyRequest
  const model = request.model ?? 'deepseek-v4-pro'
  if (typeof model !== 'string' || !ALLOWED_MODELS.has(model))
    return { ok: false as const, code: 'unsupported_model' }
  if (!validateMessages(request.messages))
    return { ok: false as const, code: 'invalid_request' }
  if (request.temperature !== undefined && (
    typeof request.temperature !== 'number'
    || !Number.isFinite(request.temperature)
    || request.temperature < 0
    || request.temperature > 2
  )) {
    return { ok: false as const, code: 'invalid_request' }
  }
  if (request.max_tokens !== undefined && (
    !Number.isInteger(request.max_tokens)
    || (request.max_tokens as number) < 1
    || (request.max_tokens as number) > 16_384
  )) {
    return { ok: false as const, code: 'invalid_request' }
  }
  if (request.stream !== undefined && typeof request.stream !== 'boolean')
    return { ok: false as const, code: 'invalid_request' }
  if (!validateTools(request.tools))
    return { ok: false as const, code: 'invalid_request' }
  if (request.thinking !== undefined && (
    !isRecord(request.thinking)
    || !['enabled', 'disabled'].includes(String(request.thinking.type))
  )) {
    return { ok: false as const, code: 'invalid_request' }
  }
  if (request.reasoning_effort !== undefined && (
    typeof request.reasoning_effort !== 'string'
    || !ALLOWED_REASONING_EFFORT.has(request.reasoning_effort)
  )) {
    return { ok: false as const, code: 'invalid_request' }
  }
  return {
    ok: true as const,
    request,
    messages: request.messages,
    model,
    stream: request.stream ?? true,
    temperature: request.temperature ?? 0,
  }
}

function quotaHeaders(reservation: ReservationResult) {
  const headers = new Headers()
  if (typeof reservation.remaining === 'number')
    headers.set('X-AI-Quota-Remaining', String(reservation.remaining))
  if (typeof reservation.daily_limit === 'number')
    headers.set('X-AI-Quota-Daily-Limit', String(reservation.daily_limit))
  if (typeof reservation.reset_at === 'string')
    headers.set('X-AI-Quota-Reset-At', reservation.reset_at)
  headers.set('X-AI-Quota-Unlimited', String(Boolean(reservation.unlimited)))
  return headers
}

function upstreamError(status: number) {
  if (status === 400 || status === 422)
    return { code: 'upstream_invalid_request', status: 400, failure: `upstream_${status}` }
  if (status === 401)
    return { code: 'upstream_auth', status: 502, failure: 'upstream_401' }
  if (status === 402)
    return { code: 'upstream_balance', status: 503, failure: 'upstream_402' }
  if (status === 429)
    return { code: 'upstream_rate_limited', status: 429, failure: 'upstream_429' }
  return { code: 'upstream_unavailable', status: 503, failure: `upstream_${status}` }
}

function readSqlState(error: unknown) {
  return isRecord(error) && typeof error.code === 'string' && /^[0-9A-Z]{5}$/u.test(error.code)
    ? error.code
    : undefined
}

function inspectSseEvent(rawEvent: string): InspectedEvent {
  const data = rawEvent
    .replaceAll('\r\n', '\n')
    .split('\n')
    .filter(line => line.startsWith('data:'))
    .map(line => line.slice('data:'.length).trimStart())
    .join('\n')
    .trim()
  if (!data) {
    return {
      done: false,
      meaningful: false,
      upstreamRequestId: null,
      finishReason: null,
      usage: null,
    }
  }
  if (data === '[DONE]') {
    return {
      done: true,
      meaningful: false,
      upstreamRequestId: null,
      finishReason: null,
      usage: null,
    }
  }

  try {
    const payload = JSON.parse(data) as Record<string, unknown>
    const choices = Array.isArray(payload.choices) ? payload.choices : []
    let meaningful = false
    let finishReason: string | null = null
    for (const rawChoice of choices) {
      if (!isRecord(rawChoice))
        continue
      if (typeof rawChoice.finish_reason === 'string')
        finishReason = rawChoice.finish_reason
      const contentEnvelope = isRecord(rawChoice.delta)
        ? rawChoice.delta
        : isRecord(rawChoice.message)
          ? rawChoice.message
          : null
      if (!contentEnvelope)
        continue
      meaningful ||= (typeof contentEnvelope.content === 'string' && contentEnvelope.content.length > 0)
        || (typeof contentEnvelope.reasoning_content === 'string' && contentEnvelope.reasoning_content.length > 0)
        || (Array.isArray(contentEnvelope.tool_calls) && contentEnvelope.tool_calls.length > 0)
    }
    const rawUsage = isRecord(payload.usage) ? payload.usage : null
    const usage = rawUsage
      ? {
          promptTokens: Number.isInteger(rawUsage.prompt_tokens) ? rawUsage.prompt_tokens as number : null,
          completionTokens: Number.isInteger(rawUsage.completion_tokens) ? rawUsage.completion_tokens as number : null,
          totalTokens: Number.isInteger(rawUsage.total_tokens) ? rawUsage.total_tokens as number : null,
        }
      : null
    return {
      done: false,
      meaningful,
      upstreamRequestId: typeof payload.id === 'string' ? payload.id.slice(0, 200) : null,
      finishReason,
      usage,
    }
  }
  catch {
    return {
      done: false,
      meaningful: false,
      upstreamRequestId: null,
      finishReason: null,
      usage: null,
    }
  }
}

function nextEventBoundary(buffer: string) {
  const lf = buffer.indexOf('\n\n')
  const crlf = buffer.indexOf('\r\n\r\n')
  if (lf < 0)
    return crlf < 0 ? null : { index: crlf, length: 4 }
  if (crlf < 0 || lf < crlf)
    return { index: lf, length: 2 }
  return { index: crlf, length: 4 }
}

function buildUpstreamBody(validated: ReturnType<typeof validateRequest> & { ok: true }) {
  const request = validated.request
  const body: Record<string, unknown> = {
    model: validated.model,
    messages: validated.messages,
    temperature: validated.temperature,
    stream: validated.stream,
  }
  if (validated.stream)
    body.stream_options = { include_usage: true }
  if (request.response_format !== undefined)
    body.response_format = request.response_format
  if (request.max_tokens !== undefined)
    body.max_tokens = request.max_tokens
  if (request.tools !== undefined)
    body.tools = request.tools
  if (request.tool_choice !== undefined)
    body.tool_choice = request.tool_choice
  if (request.thinking !== undefined)
    body.thinking = request.thinking
  if (request.reasoning_effort !== undefined)
    body.reasoning_effort = request.reasoning_effort
  return body
}

Deno.serve(async (request) => {
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
  const record = (
    outcome: 'success' | 'client_error' | 'server_error',
    status: number,
    errorCode?: string,
    sqlState?: string,
  ) => scheduleBackground(recordOperationMetric(admin, {
    requestId: context.requestId,
    functionName: FUNCTION_NAME,
    operation: OPERATION,
    outcome,
    errorCode,
    sqlState,
    status,
    durationMs: context.durationMs(),
  }), 'operation_metric_failed')

  const recordFinalizationFailure = (sqlState?: string) => {
    context.log({
      level: 'error',
      event: 'quota_finalization_failed',
      operation: 'quota_finalization',
      status: 500,
      errorCode: 'quota_finalization_failed',
      sqlState,
    })
    scheduleBackground(recordOperationMetric(admin, {
      requestId: context.requestId,
      functionName: FUNCTION_NAME,
      operation: 'quota_finalization',
      outcome: 'server_error',
      errorCode: 'quota_finalization_failed',
      sqlState,
      status: 500,
      durationMs: context.durationMs(),
    }), 'operation_metric_failed')
  }

  let userId: string | null = null
  let reservation: ReservationResult = {}
  let upstreamController: AbortController | null = null

  const release = async (failureCode: string) => {
    if (!userId)
      return false
    const { data, error } = await admin.rpc('release_ai_credit_request', {
      p_request_id: context.requestId,
      p_user_id: userId,
      p_failure_code: failureCode,
    })
    const ok = !error && Boolean((data as LedgerResult | null)?.ok)
    if (!ok)
      recordFinalizationFailure(readSqlState(error))
    return ok
  }

  const settle = async (params: {
    deliveryState: 'completed' | 'partial'
    usage: StreamUsage | null
    finishReason: string | null
    upstreamRequestId: string | null
    failureCode?: string
  }) => {
    if (!userId)
      return false
    const { data, error } = await admin.rpc('settle_ai_credit_request', {
      p_request_id: context.requestId,
      p_user_id: userId,
      p_delivery_state: params.deliveryState,
      p_prompt_tokens: params.usage?.promptTokens ?? null,
      p_completion_tokens: params.usage?.completionTokens ?? null,
      p_total_tokens: params.usage?.totalTokens ?? null,
      p_finish_reason: params.finishReason,
      p_upstream_request_id: params.upstreamRequestId,
      p_failure_code: params.failureCode ?? null,
    })
    const ok = !error && Boolean((data as LedgerResult | null)?.ok)
    if (!ok)
      recordFinalizationFailure(readSqlState(error))
    return ok
  }

  try {
    const identity = await authenticateSupabaseUser({
      request,
      client: admin,
      supabaseUrl,
    })
    userId = identity.userId
    if (!userId)
      throw new SupabaseAuthenticationError()

    const rawBody = await request.text()
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      record('client_error', 413, 'payload_too_large')
      return context.json({ error: 'payload_too_large' }, 413)
    }
    let value: unknown
    try {
      value = JSON.parse(rawBody)
    }
    catch {
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
      return context.json({
        error: errorCode,
        remaining: reservation.remaining ?? 0,
        daily_limit: reservation.daily_limit ?? 0,
        reset_at: reservation.reset_at ?? null,
      }, status, reservationHeaders)
    }

    upstreamController = new AbortController()
    const abortUpstream = () => upstreamController?.abort()
    request.signal.addEventListener('abort', abortUpstream, { once: true })
    let upstreamTimedOut = false
    const timeoutId = setTimeout(() => {
      upstreamTimedOut = true
      upstreamController?.abort()
    }, UPSTREAM_TIMEOUT_MS)
    let upstream: Response
    try {
      upstream = await fetch(DEEPSEEK_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'X-Request-Id': context.requestId,
        },
        body: JSON.stringify(buildUpstreamBody(validated)),
        signal: upstreamController.signal,
      })
    }
    catch {
      clearTimeout(timeoutId)
      request.signal.removeEventListener('abort', abortUpstream)
      await release(upstreamTimedOut ? 'upstream_timeout' : 'upstream_fetch_failed')
      record('server_error', 503, 'upstream_unavailable')
      return context.json({ error: 'upstream_unavailable' }, 503, reservationHeaders)
    }

    if (!upstream.ok) {
      clearTimeout(timeoutId)
      request.signal.removeEventListener('abort', abortUpstream)
      const mapped = upstreamError(upstream.status)
      await release(mapped.failure)
      context.log({
        level: upstream.status >= 500 || upstream.status === 402 ? 'error' : 'warn',
        event: 'upstream_failed',
        operation: OPERATION,
        status: mapped.status,
        errorCode: mapped.code,
        upstreamStatus: upstream.status,
        authMode: identity.authMode,
      })
      record(mapped.status >= 500 ? 'server_error' : 'client_error', mapped.status, mapped.code)
      return context.json({ error: mapped.code }, mapped.status, reservationHeaders)
    }

    if (!upstream.body) {
      clearTimeout(timeoutId)
      request.signal.removeEventListener('abort', abortUpstream)
      await release('upstream_empty_body')
      record('server_error', 503, 'upstream_unavailable')
      return context.json({ error: 'upstream_unavailable' }, 503, reservationHeaders)
    }

    if (!validated.stream) {
      let payload: unknown
      try {
        payload = await upstream.json()
      }
      catch {
        await release('upstream_invalid_response')
        record('server_error', 502, 'upstream_unavailable')
        return context.json({ error: 'upstream_unavailable' }, 502, reservationHeaders)
      }
      finally {
        clearTimeout(timeoutId)
        request.signal.removeEventListener('abort', abortUpstream)
      }
      const event = inspectSseEvent(`data: ${JSON.stringify(payload)}\n\n`)
      if (!event.meaningful) {
        await release('upstream_empty_response')
        record('server_error', 502, 'upstream_unavailable')
        return context.json({ error: 'upstream_unavailable' }, 502, reservationHeaders)
      }
      const markResult = await admin.rpc('mark_ai_request_delivery_started', {
        p_request_id: context.requestId,
        p_user_id: userId,
        p_upstream_request_id: event.upstreamRequestId,
      })
      if (markResult.error || !(markResult.data as LedgerResult | null)?.ok) {
        recordFinalizationFailure(readSqlState(markResult.error))
        await release('delivery_mark_failed')
        record('server_error', 503, 'quota_finalization_failed')
        return context.json({ error: 'quota_finalization_failed' }, 503, reservationHeaders)
      }
      await settle({
        deliveryState: 'completed',
        usage: event.usage,
        finishReason: event.finishReason,
        upstreamRequestId: event.upstreamRequestId,
      })
      record('success', 200)
      return context.json(payload, 200, reservationHeaders)
    }

    const reader = upstream.body.getReader()
    const decoder = new TextDecoder()
    const encoder = new TextEncoder()
    let buffer = ''
    let deliveryStarted = false
    let ledgerFinalized = false
    let upstreamRequestId: string | null = null
    let finishReason: string | null = null
    let usage: StreamUsage | null = null

    const finishLedger = async (
      deliveryState: 'completed' | 'partial' | 'none',
      failureCode?: string,
    ) => {
      if (ledgerFinalized)
        return true
      ledgerFinalized = true
      const ok = deliveryState === 'none'
        ? await release(failureCode ?? 'upstream_stream_failed')
        : await settle({
            deliveryState,
            usage,
            finishReason,
            upstreamRequestId,
            failureCode,
          })
      clearTimeout(timeoutId)
      request.signal.removeEventListener('abort', abortUpstream)
      return ok
    }

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const failStream = async (code: string) => {
          upstreamController?.abort()
          const finalState = deliveryStarted ? 'partial' : 'none'
          await finishLedger(finalState, code)
          context.log({
            level: 'error',
            event: 'stream_failed',
            operation: OPERATION,
            status: 502,
            errorCode: code,
          })
          record('server_error', 502, code)
          controller.error(new Error(code))
        }

        try {
          while (true) {
            const result = await reader.read()
            if (result.done) {
              buffer += decoder.decode()
              if (!ledgerFinalized)
                await failStream('upstream_stream_failed')
              return
            }
            buffer += decoder.decode(result.value, { stream: true })
            let boundary = nextEventBoundary(buffer)
            while (boundary) {
              const end = boundary.index + boundary.length
              const rawEvent = buffer.slice(0, end)
              buffer = buffer.slice(end)
              const inspected = inspectSseEvent(rawEvent)
              upstreamRequestId = inspected.upstreamRequestId ?? upstreamRequestId
              finishReason = inspected.finishReason ?? finishReason
              usage = inspected.usage ?? usage

              if (inspected.meaningful && !deliveryStarted) {
                const markResult = await admin.rpc('mark_ai_request_delivery_started', {
                  p_request_id: context.requestId,
                  p_user_id: userId,
                  p_upstream_request_id: upstreamRequestId,
                })
                if (markResult.error || !(markResult.data as LedgerResult | null)?.ok) {
                  recordFinalizationFailure(readSqlState(markResult.error))
                  await failStream('quota_finalization_failed')
                  return
                }
                deliveryStarted = true
              }

              if (inspected.done) {
                await finishLedger(
                  deliveryStarted ? 'completed' : 'none',
                  deliveryStarted ? undefined : 'upstream_empty_response',
                )
                record('success', 200)
                controller.enqueue(encoder.encode(rawEvent))
                controller.close()
                await reader.cancel()
                return
              }

              controller.enqueue(encoder.encode(rawEvent))
              boundary = nextEventBoundary(buffer)
            }
          }
        }
        catch {
          if (!ledgerFinalized)
            await failStream('upstream_stream_failed')
        }
      },
      async cancel() {
        upstreamController?.abort()
        await reader.cancel().catch(() => undefined)
        if (!ledgerFinalized) {
          const finalState = deliveryStarted ? 'partial' : 'none'
          await finishLedger(finalState, 'client_cancelled')
          record('client_error', 499, 'client_cancelled')
        }
      },
    })

    const headers = context.responseHeaders(reservationHeaders)
    headers.set('Content-Type', 'text/event-stream')
    headers.set('Cache-Control', 'no-cache, no-transform')
    headers.set('Connection', 'keep-alive')
    return new Response(stream, { status: 200, headers })
  }
  catch (error) {
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

    if (reservation.ok)
      await release('unexpected')
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
})
