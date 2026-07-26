import type { ChatCompletionChunk, ChatCompletionCreateParams } from 'openai/resources/chat/completions'
import { Stream } from 'openai/streaming'
import supabase from '../supabase/client'

export async function callLLM(req: ChatCompletionCreateParams, abortController?: AbortController) {
  const {
    model = 'deepseek-v4-pro',
    messages = [],
    temperature = 0,
    stream = true,
    ...rest
  } = req

  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token

  if (!token) {
    throw new Error('用户未登录，无法调用 LLM 服务')
  }

  const controller = abortController ?? new AbortController()

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/llm-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ model, messages, temperature, stream, ...rest }),
    signal: controller.signal,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`LLM request failed: ${response.status} ${errorText}`)
  }

  const streamData = Stream.fromSSEResponse<ChatCompletionChunk>(response, controller)

  return streamData
}
