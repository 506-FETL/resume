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
  let clientCancelled = false

  // 运行时的 fetch abort 不保证已返回的 body 停止，必须直接取消正在读取的流。
  const cancelReader = () => {
    reader.cancel(upstreamController.signal.reason).catch(() => undefined)
  }

  upstreamController.signal.addEventListener('abort', cancelReader, {
    once: true,
  })

  if (upstreamController.signal.aborted) cancelReader()

  const failureCode = () => {
    const reason = upstreamController.signal.reason

    return reason === 'upstream_timeout' || reason === 'client_cancelled'
      ? reason
      : 'upstream_stream_failed'
  }

  const finishLedger = async (
    deliveryState: 'completed' | 'partial' | 'none',
    failureCode?: string,
  ) => {
    if (ledgerFinalized) return true

    ledgerFinalized = true
    upstreamController.signal.removeEventListener('abort', cancelReader)
    cleanupUpstream()

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

    return ok
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const failStream = async (code: string) => {
        upstreamController.abort(code)
        cancelReader()

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

        if (!clientCancelled) {
          const message =
            code === 'upstream_timeout'
              ? 'AI 处理超时，结果未完成，请重试'
              : 'AI 输出中断，结果未完成，请重试'

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: { message, code } })}\n\n`,
            ),
          )

          controller.close()
        }
      }

      try {
        while (true) {
          const result = await reader.read()

          if (clientCancelled) return

          if (result.done) {
            buffer += decoder.decode()

            if (!ledgerFinalized) await failStream(failureCode())

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

            if (upstreamController.signal.aborted) {
              if (!clientCancelled) await failStream(failureCode())

              return
            }

            if (inspected.done) {
              if (deliveryStarted && !finishReason) {
                await failStream('upstream_stream_failed')

                return
              }

              const finalized = await finishLedger(
                deliveryStarted ? 'completed' : 'none',
                deliveryStarted ? undefined : 'upstream_empty_response',
              )

              if (!finalized) {
                await failStream('quota_finalization_failed')

                return
              }

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
        if (!ledgerFinalized && !clientCancelled)
          await failStream(failureCode())
      }
    },
    async cancel() {
      clientCancelled = true
      upstreamController.abort('client_cancelled')
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
