import type { AiMessagePart } from '@/lib/ai/types'
import { ToolCallsSection } from '@/components/ui/tool-calls-section'

type ToolCallPart = Extract<AiMessagePart, { type: 'tool-call' }>

interface ToolCallPartProps {
  calls: ToolCallPart[]
}

export function ToolCallPartGroup({ calls }: ToolCallPartProps) {
  const entries = calls.map(c => ({
    tool_name: c.toolName,
    tool_category: 'resume',
    tool_call_id: c.toolCallId,
    inputs: (c.args ?? {}) as Record<string, unknown>,
    output: c.result === undefined ? '' : JSON.stringify(c.result),
    show_category: false,
  }))
  return <ToolCallsSection toolCalls={entries} />
}
