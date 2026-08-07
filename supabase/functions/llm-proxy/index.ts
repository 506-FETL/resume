/* global Deno */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../shared/cors.ts'

interface LLMProxyRequest {
  messages: unknown[]
  model?: string
  response_format?: unknown
  temperature?: number
  stream?: boolean
  // Agent 支持：function calling（DeepSeek V4 官方支持，OpenAI 兼容）
  tools?: unknown
  tool_choice?: unknown
  // 思考模式（DeepSeek V4 支持 thinking 下的工具调用）
  thinking?: unknown
  reasoning_effort?: string
  // 注意：客户端可能仍会带 weight/action 字段，但服务端一律忽略，不用于扣费（防伪造）。
  action?: string
}

const jsonHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json',
}

// heavy 简历写工具集合（与前端 tools/ 注册的写工具对齐）。服务端据此权威判定 cost，
// 不含求职看板（job/board）类写操作。
const HEAVY_RESUME_WRITE_TOOLS = new Set<string>([
  'update_current_resume_field',
  'create_resume',
  'update_resume_meta',
  'delete_resume',
  'save_current_resume_version',
  'restore_current_resume_version',
  'delete_resume_version',
])

// 服务端权威 cost 判定：仅依据服务端可见的 payload，忽略客户端上报的 weight/action。
// - 强制最低消耗：任何一次到达的 LLM 调用 cost 至少为 1。
// - 关键点：整段对话历史每次都会全量发来，必须只看「最后一条 role==='user' 之后」的消息（当前轮），
//   否则历史里的旧 tool_calls 会把后续每一轮都误判为 heavy。
// - 当前轮里若存在 assistant 消息的 tool_calls 命中 heavy 简历写工具 → 本次调用 heavy（cost=3）；否则 light（cost=1）。
function computeCost(messages: unknown[]): { cost: number, action: string } {
  if (!Array.isArray(messages))
    return { cost: 1, action: 'chat' }

  // 定位最后一条 role==='user' 的下标
  let lastUserIdx = -1
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i] as { role?: unknown } | null
    if (m && typeof m === 'object' && m.role === 'user') {
      lastUserIdx = i
      break
    }
  }

  // 只取最后一个 user 之后的消息作为「当前轮」
  const currentTurnMsgs = lastUserIdx >= 0 ? messages.slice(lastUserIdx + 1) : messages

  const hitHeavy = currentTurnMsgs.some((raw) => {
    const m = raw as { role?: unknown, tool_calls?: unknown } | null
    if (!m || typeof m !== 'object' || m.role !== 'assistant')
      return false
    const toolCalls = m.tool_calls
    if (!Array.isArray(toolCalls))
      return false
    return toolCalls.some((tc) => {
      const name = (tc as { function?: { name?: unknown } } | null)?.function?.name
      return typeof name === 'string' && HEAVY_RESUME_WRITE_TOOLS.has(name)
    })
  })

  return hitHeavy ? { cost: 3, action: 'resume_op' } : { cost: 1, action: 'chat' }
}

// 次日 UTC 0 点（额度重置时间，简化处理）
function nextResetAtIso(): string {
  const now = new Date()
  const reset = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
    0,
  ))
  return reset.toISOString()
}

Deno.serve(async (req) => {
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    })
  }

  try {
    const {
      messages,
      model = 'deepseek-v4-pro',
      response_format,
      temperature = 0,
      stream = true,
      tools,
      tool_choice,
      thinking,
      reasoning_effort,
    } = (await req.json()) as LLMProxyRequest

    const apiKey = Deno.env.get('OPENAI_API_KEY')

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: 'API Key not configured OPENAI_API_KEY',
        }),
        {
          status: 500,
          headers: jsonHeaders,
        },
      )
    }

    // ============ 额度拦截（服务端强约束）============
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Supabase service credentials not configured' }),
        { status: 500, headers: jsonHeaders },
      )
    }

    // 从 Authorization 头取 JWT，用 service-role client 反查用户（未登录 → 401）
    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!jwt) {
      return new Response(
        JSON.stringify({ error: 'unauthorized' }),
        { status: 401, headers: jsonHeaders },
      )
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: userData, error: userErr } = await admin.auth.getUser(jwt)
    const userId = userData?.user?.id
    if (userErr || !userId) {
      return new Response(
        JSON.stringify({ error: 'unauthorized' }),
        { status: 401, headers: jsonHeaders },
      )
    }

    // 服务端权威判定本次调用的 cost 与 action（忽略客户端上报的 weight/action）
    const { cost, action } = computeCost(messages as unknown[])

    // 预检：额度不足直接 403，不调用 DeepSeek
    const { data: checkData, error: checkErr } = await admin.rpc('check_ai_quota', {
      p_user_id: userId,
      p_weight: cost,
    })
    if (checkErr) {
      return new Response(
        JSON.stringify({ error: `quota check failed: ${checkErr.message}` }),
        { status: 500, headers: jsonHeaders },
      )
    }
    const check = (checkData ?? {}) as { ok?: boolean, remaining?: number, daily_limit?: number }
    if (!check.ok) {
      return new Response(
        JSON.stringify({
          error: 'quota_exceeded',
          remaining: check.remaining ?? 0,
          daily_limit: check.daily_limit ?? 0,
          reset_at: nextResetAtIso(),
        }),
        { status: 403, headers: jsonHeaders },
      )
    }

    // 白名单透传：显式列字段，避免 ...rest 全量透传注入意外参数
    // 注意：weight / action 仅用于服务端额度扣减，绝不转发给 DeepSeek
    const requestBody: Record<string, unknown> = {
      model,
      messages, // content 可为字符串或多模态数组，原样透传（多模态为 S6 预留）
      temperature,
      stream,
    }

    if (response_format) {
      requestBody.response_format = response_format
    }

    if (tools) {
      requestBody.tools = tools
    }

    if (tool_choice) {
      requestBody.tool_choice = tool_choice
    }

    if (thinking) {
      requestBody.thinking = thinking
    }

    if (reasoning_effort) {
      requestBody.reasoning_effort = reasoning_effort
    }

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const error = await response.text()
      // 上游失败：不扣减
      return new Response(
        JSON.stringify({
          error: `DeepSeek API error: ${error}`,
        }),
        {
          status: response.status,
          headers: jsonHeaders,
        },
      )
    }

    // 上游成功：在 pipe 流之前按服务端算出的 cost 原子扣减（上游失败则不会走到这里）。
    // consume 内部会再做一次「惰性重置 + 超额校验」，扣减失败仅记录日志，不阻断已成功的响应。
    try {
      const { error: consumeErr } = await admin.rpc('consume_ai_credits', {
        p_user_id: userId,
        p_weight: cost,
        p_action: action,
      })
      if (consumeErr)
        console.error('consume_ai_credits failed:', consumeErr.message)
    }
    catch (e) {
      console.error('consume_ai_credits threw:', e instanceof Error ? e.message : e)
    }

    if (stream) {
      return new Response(response.body, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
        },
      })
    }

    const data = await response.json()
    return new Response(JSON.stringify(data), {
      headers: jsonHeaders,
    })
  }
  catch (error: unknown) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unexpected error',
      }),
      {
        status: 500,
        headers: jsonHeaders,
      },
    )
  }
})
