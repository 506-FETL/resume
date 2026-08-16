import type { ChatCompletionChunk, ChatCompletionCreateParams } from 'openai/resources/chat/completions'
import { Stream } from 'openai/streaming'
import { applyAiQuotaReservation } from '@/store/ai-quota'
import supabase from '../supabase/client'

// 额度超限错误：供上层（P3 UI）识别并展示「明日 0 点恢复」等提示。
// 通过 code 字段稳定识别，避免依赖易变的 message 文案。
export class QuotaExceededError extends Error {
  readonly code = 'quota_exceeded' as const
  readonly remaining?: number
  readonly dailyLimit?: number
  readonly resetAt?: string

  constructor(info: { remaining?: number, dailyLimit?: number, resetAt?: string } = {}) {
    super('AI 每日额度已用尽，明日 0 点恢复')
    this.name = 'QuotaExceededError'
    this.remaining = info.remaining
    this.dailyLimit = info.dailyLimit
    this.resetAt = info.resetAt
  }
}

// callLLM 的额度相关扩展参数：action（本次调用用途标记）。
// 仅作无害透传，服务端不据此扣费（cost 完全由服务端根据 payload 权威判定）。
export interface CallLLMExtras {
  action?: string
  requestId?: string
}

export async function callLLM(
  req: ChatCompletionCreateParams & CallLLMExtras,
  abortController?: AbortController,
) {
  const {
    model = 'deepseek-v4-pro',
    messages = [],
    temperature = 0,
    stream = true,
    action,
    requestId: providedRequestId,
    ...rest
  } = req

  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token

  if (!token) {
    throw new Error('用户未登录，无法调用 LLM 服务')
  }

  const controller = abortController ?? new AbortController()
  const requestId = providedRequestId ?? crypto.randomUUID()

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/llm-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-Request-Id': requestId,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      stream,
      // action 仅作无害透传（服务端不据此扣费）
      ...(action !== undefined ? { action } : {}),
      ...rest,
    }),
    signal: controller.signal,
  })

  const quotaRemaining = Number(response.headers.get('x-ai-quota-remaining'))
  const quotaDailyLimit = Number(response.headers.get('x-ai-quota-daily-limit'))
  const quotaResetAt = response.headers.get('x-ai-quota-reset-at')
  const quotaUnlimited = response.headers.get('x-ai-quota-unlimited') === 'true'

  if (
    Number.isFinite(quotaRemaining)
    && Number.isFinite(quotaDailyLimit)
    && quotaResetAt
  ) {
    applyAiQuotaReservation({
      remaining: quotaRemaining,
      dailyLimit: quotaDailyLimit,
      resetAt: quotaResetAt,
      unlimited: quotaUnlimited,
    })
  }

  if (!response.ok) {
    const errorText = await response.text()
    // 额度超限：抛出可识别的 QuotaExceededError，供上层兜底处理（本阶段不做专门 UI）
    if (response.status === 403) {
      try {
        const parsed = JSON.parse(errorText) as {
          error?: string
          remaining?: number
          daily_limit?: number
          reset_at?: string
        }
        if (parsed?.error === 'quota_exceeded') {
          throw new QuotaExceededError({
            remaining: parsed.remaining,
            dailyLimit: parsed.daily_limit,
            resetAt: parsed.reset_at,
          })
        }
      }
      catch (e) {
        if (e instanceof QuotaExceededError)
          throw e
        // JSON 解析失败则回退到通用错误
      }
    }
    throw new Error(`LLM request failed: ${response.status} ${errorText}`)
  }

  const streamData = Stream.fromSSEResponse<ChatCompletionChunk>(response, controller)

  return streamData
}
