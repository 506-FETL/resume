import type { DeliveryContext, LedgerResult } from './types.ts'
import { inspectSseEvent } from './events.ts'
import { readSqlState } from './values.ts'

export async function createCompleteResponse({
  upstream,
  admin,
  userId,
  context,
  reservationHeaders,
  ledger,
  cleanupUpstream,
}: DeliveryContext & { upstream: Response }): Promise<Response> {
  const { release, settle, record, recordFinalizationFailure } = ledger

  let payload: unknown

  try {
    payload = await upstream.json()
  } catch {
    await release('upstream_invalid_response')
    record('server_error', 502, 'upstream_unavailable')

    return context.json(
      { error: 'upstream_unavailable' },
      502,
      reservationHeaders,
    )
  } finally {
    cleanupUpstream()
  }

  const event = inspectSseEvent(`data: ${JSON.stringify(payload)}\n\n`)

  if (!event.meaningful) {
    await release('upstream_empty_response')
    record('server_error', 502, 'upstream_unavailable')

    return context.json(
      { error: 'upstream_unavailable' },
      502,
      reservationHeaders,
    )
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

    return context.json(
      { error: 'quota_finalization_failed' },
      503,
      reservationHeaders,
    )
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
