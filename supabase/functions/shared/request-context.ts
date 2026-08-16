import type { CorsMode } from './cors.ts'
import { buildCorsHeaders } from './cors.ts'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

export type RequestOutcome = 'success' | 'client_error' | 'server_error'

export interface StructuredLogEvent {
  level: 'info' | 'warn' | 'error'
  event: string
  operation: string
  status: number
  errorCode?: string
  sqlState?: string
  upstreamStatus?: number
  authMode?: string
}

export function readOrCreateRequestId(request: Request) {
  const candidate = request.headers.get('x-request-id')?.trim()
  return candidate && UUID_PATTERN.test(candidate)
    ? candidate.toLowerCase()
    : crypto.randomUUID()
}

export function createRequestContext(
  request: Request,
  functionName: string,
  corsMode: CorsMode,
) {
  const startedAt = performance.now()
  const requestId = readOrCreateRequestId(request)
  const configuredRegion = Deno.env.get('SB_REGION')?.trim() ?? ''
  const edgeRegion = /^[\w.-]{1,128}$/u.test(configuredRegion)
    ? configuredRegion
    : null

  const responseHeaders = (extra?: Headers | Record<string, string>) => {
    const headers = buildCorsHeaders(request, corsMode)
    headers.set('X-Request-Id', requestId)
    if (edgeRegion)
      headers.set('X-Sb-Edge-Region', edgeRegion)
    if (extra)
      new Headers(extra).forEach((value, key) => headers.set(key, value))
    return headers
  }

  const durationMs = () => Math.max(0, Math.round(performance.now() - startedAt))
  const log = (event: StructuredLogEvent) => {
    const record = {
      timestamp: new Date().toISOString(),
      level: event.level,
      event: event.event,
      function: functionName,
      operation: event.operation,
      requestId,
      status: event.status,
      durationMs: durationMs(),
      edgeRegion,
      ...(event.errorCode ? { errorCode: event.errorCode } : {}),
      ...(event.sqlState ? { sqlState: event.sqlState } : {}),
      ...(event.upstreamStatus ? { upstreamStatus: event.upstreamStatus } : {}),
      ...(event.authMode ? { authMode: event.authMode } : {}),
    }
    const serialized = JSON.stringify(record)
    if (event.level === 'error')
      console.error(serialized)
    else if (event.level === 'warn')
      console.warn(serialized)
  }

  const json = (body: unknown, status = 200, extra?: Headers | Record<string, string>) => {
    const headers = responseHeaders(extra)
    headers.set('Content-Type', 'application/json')
    headers.set('Cache-Control', 'no-store')
    return new Response(JSON.stringify(body), { status, headers })
  }

  return {
    requestId,
    edgeRegion,
    durationMs,
    responseHeaders,
    json,
    log,
  }
}

export type RequestContext = ReturnType<typeof createRequestContext>
/* global Deno */
