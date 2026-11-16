import { isRecord } from './values.ts'
import type { LLMProxyRequest } from './types.ts'

const ALLOWED_MODELS = new Set(['deepseek-v4-pro'])

const ALLOWED_ROLES = new Set(['system', 'user', 'assistant', 'tool'])

const ALLOWED_REASONING_EFFORT = new Set(['low', 'medium', 'high'])

function validateMessages(value: unknown): value is unknown[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 128)
    return false

  return value.every(
    (message) =>
      isRecord(message) &&
      typeof message.role === 'string' &&
      ALLOWED_ROLES.has(message.role) &&
      ('content' in message || 'tool_calls' in message),
  )
}

function validateTools(value: unknown) {
  if (value === undefined) return true
  if (!Array.isArray(value) || value.length > 64) return false

  return value.every((tool) => {
    if (!isRecord(tool) || tool.type !== 'function' || !isRecord(tool.function))
      return false

    const name = tool.function.name

    return (
      typeof name === 'string' &&
      /^\w[\w-]{0,63}$/u.test(name) &&
      JSON.stringify(tool).length <= 32_768
    )
  })
}

export function validateRequest(value: unknown) {
  if (!isRecord(value)) return { ok: false as const, code: 'invalid_request' }

  const request = value as LLMProxyRequest
  const model = request.model ?? 'deepseek-v4-pro'

  if (typeof model !== 'string' || !ALLOWED_MODELS.has(model))
    return { ok: false as const, code: 'unsupported_model' }
  if (!validateMessages(request.messages))
    return { ok: false as const, code: 'invalid_request' }
  if (
    request.temperature !== undefined &&
    (typeof request.temperature !== 'number' ||
      !Number.isFinite(request.temperature) ||
      request.temperature < 0 ||
      request.temperature > 2)
  ) {
    return { ok: false as const, code: 'invalid_request' }
  }
  if (
    request.max_tokens !== undefined &&
    (!Number.isInteger(request.max_tokens) ||
      (request.max_tokens as number) < 1 ||
      (request.max_tokens as number) > 16_384)
  ) {
    return { ok: false as const, code: 'invalid_request' }
  }
  if (request.stream !== undefined && typeof request.stream !== 'boolean')
    return { ok: false as const, code: 'invalid_request' }
  if (!validateTools(request.tools))
    return { ok: false as const, code: 'invalid_request' }
  if (
    request.thinking !== undefined &&
    (!isRecord(request.thinking) ||
      !['enabled', 'disabled'].includes(String(request.thinking.type)))
  ) {
    return { ok: false as const, code: 'invalid_request' }
  }
  if (
    request.reasoning_effort !== undefined &&
    (typeof request.reasoning_effort !== 'string' ||
      !ALLOWED_REASONING_EFFORT.has(request.reasoning_effort))
  ) {
    return { ok: false as const, code: 'invalid_request' }
  }

  return {
    ok: true as const,
    request,
    messages: request.messages,
    model,
    stream: request.stream ?? true,
    temperature: request.temperature ?? 0,
  }
}

export function buildUpstreamBody(
  validated: ReturnType<typeof validateRequest> & { ok: true },
) {
  const request = validated.request

  const body: Record<string, unknown> = {
    model: validated.model,
    messages: validated.messages,
    temperature: validated.temperature,
    stream: validated.stream,
  }

  if (validated.stream) body.stream_options = { include_usage: true }
  if (request.response_format !== undefined)
    body.response_format = request.response_format
  if (request.max_tokens !== undefined) body.max_tokens = request.max_tokens
  if (request.tools !== undefined) body.tools = request.tools
  if (request.tool_choice !== undefined) body.tool_choice = request.tool_choice
  if (request.thinking !== undefined) body.thinking = request.thinking
  if (request.reasoning_effort !== undefined)
    body.reasoning_effort = request.reasoning_effort

  return body
}
