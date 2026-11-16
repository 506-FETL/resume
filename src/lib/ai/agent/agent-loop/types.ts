import type { ExperienceSourceReference } from '@/lib/experience-sources/types'
import type { createSkillRuntime } from '../../skills/runtime'
import type { AiContextUsage, AiMessage, AiMessagePart } from '../../types'
import type { UserContext } from '../build-context'
import type { ContextCompactionEvent } from '../context-events'
import type { AgentTool, AgentToolContext } from '../tool-registry'

export interface AgentUsage {
  input: number
  output: number
  total: number
}

export interface AgentRunOptions {
  history: AiMessage[]
  signal: AbortSignal
  thinking?: boolean
  maxSteps?: number
  context?: UserContext
  summary?: string
  conversationId?: string
  sources?: ExperienceSourceReference[]
  target?: AgentToolContext['target']
  skipCompaction?: boolean
  callbacks?: {
    onParts?: (parts: AiMessagePart[]) => void
    onUsage?: (usage: AgentUsage) => void
    onContextUsage?: (usage: AiContextUsage) => void
    onCompaction?: (event: ContextCompactionEvent) => void
  }
}

export interface AgentDependencies {
  request?: (
    request: Record<string, unknown>,
    signal?: AbortSignal,
  ) => Promise<Response>
  tools?: AgentTool[]
  skillLoaders?: Parameters<typeof createSkillRuntime>[0]['loaders']
}
