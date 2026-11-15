import type { ModelMessage } from 'ai'

// Provider 能力见官方 models 接口；实际预算继续受本项目代理及任务成本限制。
export const ASSISTANT_MODEL = 'deepseek-v4-pro'

export const MODEL_CONTEXT_LIMITS = {
  model: ASSISTANT_MODEL,
  providerContextTokens: 1_048_576,
  taskContextTokens: 65_536,
  outputTokens: 8192,
  toolReserveTokens: 8192,
  summaryOutputTokens: 6000,
  requestMessages: 128,
  requestBytes: 1_048_576,
} as const

export const CONTEXT_BUDGET = {
  tokens: 40_000,
  messages: 72,
  bytes: 480_000,
  recentTurns: 4,
} as const

const hardInputTokens =
  Math.min(
    MODEL_CONTEXT_LIMITS.providerContextTokens,
    MODEL_CONTEXT_LIMITS.taskContextTokens,
  ) -
  MODEL_CONTEXT_LIMITS.outputTokens -
  MODEL_CONTEXT_LIMITS.toolReserveTokens

let usageRatio = 1
let usageSamples = 0

function rawTokenEstimate(value: unknown): number {
  const text = JSON.stringify(value)
  const nonAscii = text.match(/[^\u0020-\u007E\n\r\t]/g)?.length ?? 0

  return Math.ceil((text.length - nonAscii) / 3 + nonAscii * 1.5)
}

export function estimateContextTokens(value: unknown): number {
  return Math.ceil(rawTokenEstimate(value) * usageRatio)
}

export function recordContextUsage(value: unknown, inputTokens: number) {
  if (!Number.isFinite(inputTokens) || inputTokens <= 0) return

  const estimated = rawTokenEstimate(value)

  if (!estimated) return

  // 保留最高实测比例及 20% 余量；未知语言/结构仍至少使用原估算的 75%。
  const observed = Math.max(0.75, (inputTokens / estimated) * 1.2)

  usageRatio = usageSamples ? Math.max(usageRatio, observed) : observed
  usageSamples += 1
}

export function getContextCalibration() {
  return { model: ASSISTANT_MODEL, usageSamples, usageRatio }
}

export function createContextTokenCounter() {
  let measured: { messages: string[]; tokens: number } | undefined

  return {
    observe(messages: ModelMessage[], inputTokens: number) {
      recordContextUsage(messages, inputTokens)

      if (inputTokens > 0)
        measured = {
          messages: messages.map((m) => JSON.stringify(m)),
          tokens: inputTokens,
        }
    },
    estimate(messages: ModelMessage[], fallbackOverheadTokens = 0) {
      const samePrefix =
        measured &&
        measured.messages.length <= messages.length &&
        measured.messages.every(
          (message, index) => message === JSON.stringify(messages[index]),
        )

      if (samePrefix && measured)
        return (
          measured.tokens +
          estimateContextTokens(messages.slice(measured.messages.length))
        )

      return estimateContextTokens(messages) + fallbackOverheadTokens
    },
  }
}

export type ContextTokenCounter = ReturnType<typeof createContextTokenCounter>

export function contextNeedsCompaction(
  messages: ModelMessage[],
  counter?: ContextTokenCounter,
): boolean {
  return (
    messages.length > CONTEXT_BUDGET.messages ||
    (counter?.estimate(messages) ?? estimateContextTokens(messages)) >
      CONTEXT_BUDGET.tokens ||
    new TextEncoder().encode(JSON.stringify(messages)).byteLength >
      CONTEXT_BUDGET.bytes
  )
}

export function contextFitsRequest(
  messages: ModelMessage[],
  counter?: ContextTokenCounter,
): boolean {
  return (
    messages.length <= 112 &&
    (counter?.estimate(messages) ?? estimateContextTokens(messages)) <=
      hardInputTokens &&
    new TextEncoder().encode(JSON.stringify(messages)).byteLength <= 800_000
  )
}
