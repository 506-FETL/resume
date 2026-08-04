export interface AgentTool {
  name: string
  description: string
  parameters: Record<string, unknown> // JSON Schema，对齐 DeepSeek tools.function.parameters
  execute: (args: Record<string, unknown>) => Promise<unknown>
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

// 导出为 DeepSeek tools 数组格式
export function toApiToolDefs() {
  return getTools().map(t => ({
    type: 'function' as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }))
}
