import { createRequestContext } from '../shared/request-context.ts'
import type { BootstrapTimingName } from './bootstrap-types.ts'
import type { AdminClient } from './types.ts'
import {
  scheduleBackground,
  recordOperationMetric,
} from '../shared/operation-metrics.ts'
import type { CommentApiError } from '../shared/resume-comment-schema.ts'

let nextRequestIsColdStart = true

export function createCommentResponses(req: Request) {
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
    operation: () => PromiseLike<T>,
  ) => {
    const startedAt = performance.now()

    try {
      return await operation()
    } finally {
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

      const outcome =
        response.status >= 500
          ? ('server_error' as const)
          : response.status >= 400
            ? ('client_error' as const)
            : ('success' as const)

      scheduleBackground(
        recordOperationMetric(adminForMetrics, {
          requestId,
          functionName: 'resume-comments',
          operation,
          outcome,
          errorCode: responseErrorCode,
          sqlState: responseSqlState,
          status: response.status,
          durationMs: context.durationMs(),
        }),
        'operation_metric_failed',
      )

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

    return json(
      {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          ...(error.retryAfterSeconds
            ? { retryAfterSeconds: error.retryAfterSeconds }
            : {}),
        },
      },
      error.status,
    )
  }

  return {
    context,
    requestId,
    coldStart,
    recordTiming,
    timeOperation,
    finalize,
    json,
    success,
    failure,
    get operation() {
      return operation
    },
    set operation(value: typeof operation) {
      operation = value
    },
    get responseErrorCode() {
      return responseErrorCode
    },
    set responseErrorCode(value: typeof responseErrorCode) {
      responseErrorCode = value
    },
    get responseSqlState() {
      return responseSqlState
    },
    set responseSqlState(value: typeof responseSqlState) {
      responseSqlState = value
    },
    get adminForMetrics() {
      return adminForMetrics
    },
    set adminForMetrics(value: typeof adminForMetrics) {
      adminForMetrics = value
    },
  }
}
