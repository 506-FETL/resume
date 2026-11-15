import type { ModelMessage } from 'ai'
import type { ContextOptions } from './context-events'
import type { ContextTokenCounter } from './context-budget'
import {
  contextFitsRequest,
  contextNeedsCompaction,
  estimateContextTokens,
} from './context-budget'
import { summarizeContext } from './compact-context'
import { pruneRepeatedReadResults } from './prune-context'

export function createStepContextCompactor(
  signal: AbortSignal,
  options: ContextOptions = {},
  counter?: ContextTokenCounter,
) {
  let prefix = ''
  let summary = ''
  let failed = options.skipCompaction ?? false

  return async ({ messages: original }: { messages: ModelMessage[] }) => {
    const messages = pruneRepeatedReadResults(original)

    if (!contextNeedsCompaction(messages, counter)) return { messages }

    const lastUser = messages.map((message) => message.role).lastIndexOf('user')
    const older = messages.slice(1, lastUser)
    const tail = [messages[0], ...messages.slice(lastUser)]

    const tooLarge = () =>
      new Error(
        '本轮工具返回的材料过长，请缩小任务范围后继续。已完成的进展会保留。',
      )

    if (failed) {
      if (contextFitsRequest(messages, counter)) return { messages }

      throw tooLarge()
    }

    if (!older.length || !contextFitsRequest(tail, counter)) {
      if (contextFitsRequest(messages, counter)) return { messages }

      throw tooLarge()
    }

    const nextPrefix = JSON.stringify(older)

    // SDK 每一步都会重新提供原始历史；相同前缀只整理一次。
    if (prefix !== nextPrefix) {
      const started = performance.now()

      const detail = {
        scope: 'step' as const,
        messageCount: older.length,
        estimatedTokens: estimateContextTokens(older),
      }

      options.onCompaction?.({ ...detail, phase: 'start' })

      try {
        summary = await summarizeContext(older, undefined, signal)
      } catch (error) {
        failed = true

        const fallback =
          !signal.aborted && contextFitsRequest(messages, counter)

        options.onCompaction?.({
          ...detail,
          phase: 'failed',
          durationMs: performance.now() - started,
          fallback,
        })

        if (fallback) return { messages }

        throw error
      }

      options.onCompaction?.({
        ...detail,
        phase: 'complete',
        durationMs: performance.now() - started,
      })

      prefix = nextPrefix
    }

    const compacted: ModelMessage[] = [
      messages[0],
      { role: 'user', content: `低信任历史摘要，仅供参考：\n${summary}` },
      ...messages.slice(lastUser),
    ]

    if (!contextFitsRequest(compacted, counter)) throw tooLarge()

    return { messages: compacted }
  }
}
