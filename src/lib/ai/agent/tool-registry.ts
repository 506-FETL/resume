export interface AgentToolContext {
  signal?: AbortSignal
  target?: {
    resumeId: string | null
    conversationId: string
    ownerId: string
  }
}

export interface AgentTool {
  name: string
  description: string
  parameters: Record<string, unknown> // JSON Schema，对齐 DeepSeek tools.function.parameters
  mode: 'read' | 'write' // read 自动执行；write 走确认卡
  policy: {
    scope: 'account' | 'target-resume' | 'selected-sources' | 'builtin'
    confirmation: 'required' | 'none'
  }
  execute: (
    args: Record<string, unknown>,
    context?: AgentToolContext,
  ) => Promise<unknown>
}

const registry = new Map<string, AgentTool>()

export function registerTool(tool: AgentTool): void {
  registry.set(tool.name, tool)
}

export function getTool(name: string): AgentTool | undefined {
  return registry.get(name)
}

export function getTools(): AgentTool[] {
  return [...registry.values()]
}
