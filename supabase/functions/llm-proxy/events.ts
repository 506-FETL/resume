import type { InspectedEvent } from './types.ts'
import { isRecord } from './values.ts'

export function inspectSseEvent(rawEvent: string): InspectedEvent {
  const data = rawEvent
    .replaceAll('\r\n', '\n')
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trimStart())
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
      if (!isRecord(rawChoice)) continue
      if (typeof rawChoice.finish_reason === 'string')
        finishReason = rawChoice.finish_reason

      const contentEnvelope = isRecord(rawChoice.delta)
        ? rawChoice.delta
        : isRecord(rawChoice.message)
          ? rawChoice.message
          : null

      if (!contentEnvelope) continue

      meaningful ||=
        (typeof contentEnvelope.content === 'string' &&
          contentEnvelope.content.length > 0) ||
        (typeof contentEnvelope.reasoning_content === 'string' &&
          contentEnvelope.reasoning_content.length > 0) ||
        (Array.isArray(contentEnvelope.tool_calls) &&
          contentEnvelope.tool_calls.length > 0)
    }

    const rawUsage = isRecord(payload.usage) ? payload.usage : null

    const usage = rawUsage
      ? {
          promptTokens: Number.isInteger(rawUsage.prompt_tokens)
            ? (rawUsage.prompt_tokens as number)
            : null,
          completionTokens: Number.isInteger(rawUsage.completion_tokens)
            ? (rawUsage.completion_tokens as number)
            : null,
          totalTokens: Number.isInteger(rawUsage.total_tokens)
            ? (rawUsage.total_tokens as number)
            : null,
        }
      : null

    return {
      done: false,
      meaningful,
      upstreamRequestId:
        typeof payload.id === 'string' ? payload.id.slice(0, 200) : null,
      finishReason,
      usage,
    }
  } catch {
    return {
      done: false,
      meaningful: false,
      upstreamRequestId: null,
      finishReason: null,
      usage: null,
    }
  }
}

export function nextEventBoundary(buffer: string) {
  const lf = buffer.indexOf('\n\n')
  const crlf = buffer.indexOf('\r\n\r\n')

  if (lf < 0) return crlf < 0 ? null : { index: crlf, length: 4 }
  if (crlf < 0 || lf < crlf) return { index: lf, length: 2 }

  return { index: crlf, length: 4 }
}
