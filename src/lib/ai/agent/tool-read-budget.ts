import {
  CONTEXT_BUDGET,
  MODEL_CONTEXT_LIMITS,
  estimateContextTokens,
} from './context-budget'
import { serializeAiToolValue } from './serialize-tool-value'

export const DEFAULT_TOOL_READ_BUDGET = {
  tokens: CONTEXT_BUDGET.tokens - MODEL_CONTEXT_LIMITS.toolReserveTokens,
  bytes: CONTEXT_BUDGET.bytes - MODEL_CONTEXT_LIMITS.outputTokens * 4,
}

export function createToolReadBudgetTracker() {
  let usedTokens = 0
  let usedBytes = 0

  return {
    start(request: unknown) {
      usedTokens = estimateContextTokens(request)
      usedBytes = new TextEncoder().encode(JSON.stringify(request)).byteLength
    },
    available() {
      return {
        tokens: Math.max(0, DEFAULT_TOOL_READ_BUDGET.tokens - usedTokens),
        bytes: Math.max(0, DEFAULT_TOOL_READ_BUDGET.bytes - usedBytes),
      }
    },
    consume(output: unknown) {
      const serialized = serializeAiToolValue(output) ?? ''

      usedTokens += estimateContextTokens(serialized)
      usedBytes += new TextEncoder().encode(
        JSON.stringify(serialized),
      ).byteLength
    },
  }
}
