import type { ImportMapping } from '../shared/resume-import-contract.ts'
import type { ImportErrorCode } from './core.ts'
import {
  buildCorsHeaders,
  corsPreflightResponse,
  isOriginAllowed,
} from '../shared/cors.ts'
import {
  IMPORT_MAPPING_VERSION,
  MAX_IMPORT_AI_CHARACTERS,
  MAX_IMPORT_AI_LINES,
  normalizeImportLines,
  validateImportMapping,
} from '../shared/resume-import-contract.ts'
import {
  hashImportLines,
  ImportError,
  IMPORT_REQUEST_TIMEOUT_MS,
  readBoundedJson,
  requestImportMapping,
} from './core.ts'

export type ImportReservation =
  | { state: 'cached'; mapping: unknown }
  | { state: 'reserved'; leaseId: string }
  | { state: 'rate_limited' | 'processing' | 'unavailable' }

export interface ImportDependencies {
  apiKey: string
  authenticate: (
    request: Request,
    signal: AbortSignal,
  ) => Promise<string | null>
  reserve: (params: {
    userId: string
    contentHash: string
    signal: AbortSignal
  }) => Promise<ImportReservation>
  finish: (params: {
    userId: string
    contentHash: string
    leaseId: string
    mapping: ImportMapping | null
    signal: AbortSignal
  }) => Promise<boolean>
  fetcher: typeof fetch
  timeoutMs?: number
  upstreamTimeoutMs?: number
}

const ERROR_STATUS: Record<ImportErrorCode, number> = {
  unauthorized: 401,
  too_large: 413,
  rate_limited: 429,
  processing: 409,
  unavailable: 503,
  invalid_request: 400,
}

export async function handleImportRequest(
  request: Request,
  dependencies: ImportDependencies,
): Promise<Response> {
  if (request.method === 'OPTIONS')
    return corsPreflightResponse(request, 'allowlist')

  const headers = buildCorsHeaders(request, 'allowlist')

  headers.set('Content-Type', 'application/json; charset=utf-8')
  headers.set('Cache-Control', 'no-store')

  const respond = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), { status, headers })

  const fail = (code: ImportErrorCode) =>
    respond({ error: code }, ERROR_STATUS[code])

  if (!isOriginAllowed(request, 'allowlist') || request.method !== 'POST')
    return fail('invalid_request')

  const controller = new AbortController()
  const abort = () => controller.abort()

  const timeout = setTimeout(
    abort,
    dependencies.timeoutMs ?? IMPORT_REQUEST_TIMEOUT_MS,
  )

  request.signal.addEventListener('abort', abort, { once: true })

  try {
    if (request.signal.aborted) controller.abort()

    const userId = await dependencies.authenticate(request, controller.signal)

    if (!userId) return fail('unauthorized')
    if (!dependencies.apiKey) return fail('unavailable')

    const declaredSize = Number(request.headers.get('Content-Length'))

    if (declaredSize > 256_000) return fail('too_large')

    const body = await readBoundedJson(request.body, 256_000, controller.signal)

    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).length !== 1 ||
      !('text' in body) ||
      typeof body.text !== 'string'
    )
      return fail('invalid_request')

    const lines = normalizeImportLines(body.text)

    if (!lines.length) return fail('invalid_request')
    if (
      lines.length > MAX_IMPORT_AI_LINES ||
      lines.join('\n').length > MAX_IMPORT_AI_CHARACTERS
    )
      return fail('too_large')

    const contentHash = await hashImportLines(lines)

    const reservation = await dependencies.reserve({
      userId,
      contentHash,
      signal: controller.signal,
    })

    if (reservation.state === 'cached') {
      if (!validateImportMapping(reservation.mapping, lines))
        return fail('unavailable')

      return respond(
        {
          version: IMPORT_MAPPING_VERSION,
          mapping: reservation.mapping,
          cached: true,
        },
        200,
      )
    }
    if (reservation.state !== 'reserved') return fail(reservation.state)

    let mapping: ImportMapping

    try {
      mapping = await requestImportMapping({
        lines,
        apiKey: dependencies.apiKey,
        signal: controller.signal,
        fetcher: dependencies.fetcher,
        timeoutMs: dependencies.upstreamTimeoutMs,
      })
    } catch {
      // If the process/connection is gone, the lease expires; the next attempt
      // still counts the abandoned upstream call against both daily limits.
      await dependencies
        .finish({
          userId,
          contentHash,
          leaseId: reservation.leaseId,
          mapping: null,
          signal: controller.signal,
        })
        .catch(() => undefined)

      return fail('unavailable')
    }

    const saved = await dependencies.finish({
      userId,
      contentHash,
      leaseId: reservation.leaseId,
      mapping,
      signal: controller.signal,
    })

    if (!saved) return fail('unavailable')

    return respond(
      { version: IMPORT_MAPPING_VERSION, mapping, cached: false },
      200,
    )
  } catch (error) {
    return fail(error instanceof ImportError ? error.code : 'unavailable')
  } finally {
    clearTimeout(timeout)
    request.signal.removeEventListener('abort', abort)
  }
}
