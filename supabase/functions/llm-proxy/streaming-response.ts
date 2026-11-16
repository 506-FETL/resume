import type { DeliveryContext, StreamUsage, LedgerResult } from './types.ts'
import { streamFailureDeliveryState } from './core.ts'
import { OPERATION } from './constants.ts'
import { nextEventBoundary, inspectSseEvent } from './events.ts'
import { readSqlState } from './values.ts'

export function createStreamingResponse({
  body,
  upstreamController,
  admin,
  userId,
  context,
  reservationHeaders,
  ledger,
  cleanupUpstream,
}: DeliveryContext & {
  body: ReadableStream<Uint8Array>
  upstreamController: AbortController
}): Response {
  const { release, settle, record, recordFinalizationFailure } = ledger
  const reader = body.getReader()
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
    if (ledgerFinalized) return true

    ledgerFinalized = true

    const ok =
      deliveryState === 'none'
        ? await release(failureCode ?? 'upstream_stream_failed')
        : await settle({
            deliveryState,
            usage,
            finishReason,
            upstreamRequestId,
            failureCode,
          })

    cleanupUpstream()

    return ok
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const failStream = async (code: string) => {
        upstreamController?.abort()

        const finalState = streamFailureDeliveryState(deliveryStarted)

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

            if (!ledgerFinalized) await failStream('upstream_stream_failed')

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
              const markResult = await admin.rpc(
                'mark_ai_request_delivery_started',
                {
                  p_request_id: context.requestId,
                  p_user_id: userId,
                  p_upstream_request_id: upstreamRequestId,
                },
              )

              if (
                markResult.error ||
                !(markResult.data as LedgerResult | null)?.ok
              ) {
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
      } catch {
        if (!ledgerFinalized) await failStream('upstream_stream_failed')
      }
    },
    async cancel() {
      upstreamController?.abort()
      await reader.cancel().catch(() => undefined)

      if (!ledgerFinalized) {
        const finalState = streamFailureDeliveryState(deliveryStarted)

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
