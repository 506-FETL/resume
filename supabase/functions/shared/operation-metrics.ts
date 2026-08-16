import type { RequestOutcome } from './request-context.ts'

interface MetricsClient {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ error: { code?: string } | null }>
}

export interface OperationMetric {
  requestId: string
  functionName: string
  operation: string
  outcome: RequestOutcome
  errorCode?: string
  sqlState?: string
  status: number
  durationMs: number
}

export function scheduleBackground(task: Promise<unknown>, eventName = 'background_task_failed') {
  const guarded = task.catch(() => {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      event: eventName,
    }))
  })
  const edgeRuntime = (globalThis as typeof globalThis & {
    EdgeRuntime?: { waitUntil: (promise: Promise<unknown>) => void }
  }).EdgeRuntime
  if (edgeRuntime?.waitUntil)
    edgeRuntime.waitUntil(guarded)
  else
    guarded.catch(() => undefined)
}

export async function recordOperationMetric(
  client: MetricsClient,
  metric: OperationMetric,
) {
  const { error } = await client.rpc('record_backend_operation', {
    p_request_id: metric.requestId,
    p_function_name: metric.functionName,
    p_operation: metric.operation,
    p_outcome: metric.outcome,
    p_error_code: metric.errorCode ?? null,
    p_sql_state: metric.sqlState ?? null,
    p_status: metric.status,
    p_duration_ms: Math.max(0, Math.round(metric.durationMs)),
  })
  if (error)
    throw new Error('operation metric write failed')
}
