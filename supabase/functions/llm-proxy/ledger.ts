import type { ReservationResult, LedgerResult, StreamUsage } from './types.ts'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.103.0'
import type { RequestContext } from '../shared/request-context.ts'
import {
  scheduleBackground,
  recordOperationMetric,
} from '../shared/operation-metrics.ts'
import { FUNCTION_NAME, OPERATION } from './constants.ts'
import { readSqlState } from './values.ts'

export function quotaHeaders(reservation: ReservationResult) {
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

export function createQuotaLedger(
  admin: SupabaseClient,
  context: RequestContext,
) {
  const record = (
    outcome: 'success' | 'client_error' | 'server_error',
    status: number,
    errorCode?: string,
    sqlState?: string,
  ) =>
    scheduleBackground(
      recordOperationMetric(admin, {
        requestId: context.requestId,
        functionName: FUNCTION_NAME,
        operation: OPERATION,
        outcome,
        errorCode,
        sqlState,
        status,
        durationMs: context.durationMs(),
      }),
      'operation_metric_failed',
    )

  const recordFinalizationFailure = (sqlState?: string) => {
    context.log({
      level: 'error',
      event: 'quota_finalization_failed',
      operation: 'quota_finalization',
      status: 500,
      errorCode: 'quota_finalization_failed',
      sqlState,
    })

    scheduleBackground(
      recordOperationMetric(admin, {
        requestId: context.requestId,
        functionName: FUNCTION_NAME,
        operation: 'quota_finalization',
        outcome: 'server_error',
        errorCode: 'quota_finalization_failed',
        sqlState,
        status: 500,
        durationMs: context.durationMs(),
      }),
      'operation_metric_failed',
    )
  }

  let userId: string | null = null

  const release = async (failureCode: string) => {
    if (!userId) return false

    const { data, error } = await admin.rpc('release_ai_credit_request', {
      p_request_id: context.requestId,
      p_user_id: userId,
      p_failure_code: failureCode,
    })

    const ok = !error && Boolean((data as LedgerResult | null)?.ok)

    if (!ok) recordFinalizationFailure(readSqlState(error))

    return ok
  }

  const settle = async (params: {
    deliveryState: 'completed' | 'partial'
    usage: StreamUsage | null
    finishReason: string | null
    upstreamRequestId: string | null
    failureCode?: string
  }) => {
    if (!userId) return false

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

    if (!ok) recordFinalizationFailure(readSqlState(error))

    return ok
  }

  return {
    record,
    recordFinalizationFailure,
    release,
    settle,
    set userId(value: string | null) {
      userId = value
    },
  }
}
