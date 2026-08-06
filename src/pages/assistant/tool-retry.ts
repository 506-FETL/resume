import type { AiMessagePart } from '@/lib/ai/types'
import { toast } from 'sonner'
import { getTool } from '@/lib/ai/agent'
import useAssistantStore from './store'

type ToolCallPart = Extract<AiMessagePart, { type: 'tool-call' }>

// 就地更新某个工具调用 part（按 toolCallId 定位所在消息）。仅更新会话内存态，不回写 DB。
function patchToolPart(toolCallId: string, patch: Partial<ToolCallPart>): void {
  const { messages, replaceMessage } = useAssistantStore.getState()
  for (const m of messages) {
    const idx = m.parts.findIndex(p => p.type === 'tool-call' && p.toolCallId === toolCallId)
    if (idx >= 0) {
      const updatedParts = m.parts.map((p, i) => (i === idx ? { ...(p as ToolCallPart), ...patch } : p))
      replaceMessage(m.id, { ...m, parts: updatedParts })
      return
    }
  }
}

function findToolPart(toolCallId: string): ToolCallPart | undefined {
  for (const m of useAssistantStore.getState().messages) {
    const found = m.parts.find(p => p.type === 'tool-call' && p.toolCallId === toolCallId)
    if (found)
      return found as ToolCallPart
  }
  return undefined
}

// 失败的工具调用单独重试：重新执行该工具，并就地刷新其状态/结果。
// 写工具会再次经过确认卡（useWriteConfirmBridge）。
export async function retryToolCall(toolCallId: string): Promise<void> {
  const part = findToolPart(toolCallId)
  if (!part)
    return
  const tool = getTool(part.toolName)
  if (!tool) {
    toast.error('工具不存在，无法重试', { description: part.toolName })
    return
  }

  patchToolPart(toolCallId, { state: 'call', result: undefined })
  try {
    const result = await tool.execute((part.args ?? {}) as Record<string, unknown>)
    let isError = false
    let cancelled = false
    if (result && typeof result === 'object') {
      const obj = result as Record<string, unknown>
      if ('error' in obj)
        isError = true
      if ('cancelled' in obj && obj.cancelled)
        cancelled = true
    }
    patchToolPart(toolCallId, { result, state: isError ? 'error' : cancelled ? 'cancelled' : 'result' })
    if (isError)
      toast.error('重试仍失败', { description: String((result as Record<string, unknown>).error ?? '') })
  }
  catch (e) {
    patchToolPart(toolCallId, {
      result: { error: e instanceof Error ? e.message : '工具执行失败' },
      state: 'error',
    })
    toast.error('重试失败', { description: e instanceof Error ? e.message : '工具执行失败' })
  }
}
