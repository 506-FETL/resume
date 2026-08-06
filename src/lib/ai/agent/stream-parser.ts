export interface ParsedToolCall {
  id: string
  name: string
  args: Record<string, unknown>
}

// token 用量（部分模型仅在最后一个 chunk 返回）
export interface StreamUsage {
  input: number
  output: number
  total: number
}

export interface StreamParserCallbacks {
  onText?: (delta: string, full: string) => void
  onReasoning?: (delta: string, full: string) => void
}

// 累积 DeepSeek SSE：content / reasoning_content / tool_calls（按 index 归并分片）
export class StreamParser {
  private text = ''
  private reasoning = ''
  private toolAcc = new Map<number, { id: string, name: string, argsText: string }>()
  private finishReason: string | null = null
  private usage: StreamUsage | null = null
  private callbacks: StreamParserCallbacks

  constructor(callbacks: StreamParserCallbacks = {}) {
    this.callbacks = callbacks
  }

  push(chunk: any): void {
    // usage 可能出现在最后一个（choices 为空的）chunk 上
    const u = chunk?.usage
    if (u) {
      this.usage = {
        input: Number(u.prompt_tokens ?? 0),
        output: Number(u.completion_tokens ?? 0),
        total: Number(u.total_tokens ?? (Number(u.prompt_tokens ?? 0) + Number(u.completion_tokens ?? 0))),
      }
    }
    const choice = chunk?.choices?.[0]
    if (!choice)
      return
    const delta = choice.delta ?? {}

    if (typeof delta.content === 'string' && delta.content) {
      this.text += delta.content
      this.callbacks.onText?.(delta.content, this.text)
    }
    if (typeof delta.reasoning_content === 'string' && delta.reasoning_content) {
      this.reasoning += delta.reasoning_content
      this.callbacks.onReasoning?.(delta.reasoning_content, this.reasoning)
    }
    if (Array.isArray(delta.tool_calls)) {
      for (const tc of delta.tool_calls) {
        const idx = tc.index ?? 0
        const cur = this.toolAcc.get(idx) ?? { id: '', name: '', argsText: '' }
        if (tc.id)
          cur.id = tc.id
        if (tc.function?.name)
          cur.name = tc.function.name
        if (typeof tc.function?.arguments === 'string')
          cur.argsText += tc.function.arguments
        this.toolAcc.set(idx, cur)
      }
    }
    if (choice.finish_reason)
      this.finishReason = choice.finish_reason
  }

  result(): { text: string, reasoning: string, toolCalls: ParsedToolCall[], finishReason: string | null, usage: StreamUsage | null } {
    const toolCalls: ParsedToolCall[] = [...this.toolAcc.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, v]) => {
        let args: Record<string, unknown> = {}
        try {
          args = v.argsText ? JSON.parse(v.argsText) : {}
        }
        catch {
          args = {}
        }
        return { id: v.id, name: v.name, args }
      })
    return { text: this.text, reasoning: this.reasoning, toolCalls, finishReason: this.finishReason, usage: this.usage }
  }
}
