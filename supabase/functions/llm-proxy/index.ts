/* global Deno */

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
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        },
      )
    }

    // 白名单透传：显式列字段，避免 ...rest 全量透传注入意外参数
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
      return new Response(
        JSON.stringify({
          error: `DeepSeek API error: ${error}`,
        }),
        {
          status: response.status,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        },
      )
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
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    })
  }
  catch (error: unknown) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unexpected error',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    )
  }
})
