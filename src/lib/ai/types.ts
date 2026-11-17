import type {
  ExperienceSourceBlock,
  ExperienceSourceReference,
  ExperienceSourceRelation,
} from '@/lib/experience-sources/types'
import type { CommentAnchor } from '../../features/resume-comments/anchors/types.ts'

// AI 助手核心数据类型。parts 是「前端 <-> DB」存储契约，
// 与 DeepSeek 线上 messages 格式解耦（发给模型时由 S3 agent 层转换）。

export type AiMessageRole = 'user' | 'assistant' | 'system'

export type AiToolCallState =
  | 'call'
  | 'awaiting-confirm'
  | 'result'
  | 'error'
  | 'cancelled'

export interface AiSkillReference {
  type: 'skill-reference'
  skillId: string
  version: string
  displayName: string
}

export type AiReferencePart =
  | { type: 'reference'; kind: 'resume' | 'job'; id: string; label: string }
  | { type: 'reference'; kind: 'legacy-job'; id: string; label: string }
  | {
      type: 'reference'
      kind: 'command'
      id: string
      label: string
      version: string
    }
  | {
      type: 'reference'
      kind: 'experience'
      id: string
      label: string
      versionId: string
    }
  | {
      type: 'reference'
      kind: 'annotation'
      id: string
      label: string
      resumeId: string
      documentHash?: string
      anchors: CommentAnchor[]
      fields?: { nodeKey: string; label: string }[]
    }

export type AiUserReference = AiReferencePart | AiSkillReference

export interface AiSkillActivity {
  type: 'skill-activity'
  id: string
  skillId: string
  version: string
  displayName: string
  state: 'loading' | 'ready' | 'error'
  error?: string
}

export interface AiContextUsage {
  type: 'context-usage'
  inputTokens: number
  outputTokens?: number
  reasoningTokens?: number
  estimated: boolean
  model: string
  sourceFingerprint: string
  targetResumeId?: string | null
}

export type AiMessagePart =
  | AiContextUsage
  | {
      type: 'citation-evidence'
      sources: (ExperienceSourceReference & { block: ExperienceSourceBlock })[]
    }
  | { type: 'text'; text: string; inputFormat?: 'plain' }
  | {
      type: 'source-scope'
      sources: ExperienceSourceRelation[]
      targetResumeId?: string | null
    }
  | { type: 'revision'; proposalId: string; feedback: string }
  | AiSkillReference
  | AiReferencePart
  | AiSkillActivity
  | {
      type: 'tool-call'
      toolCallId: string
      toolName: string
      step?: number // 同一模型回复中的工具共享轮次，恢复历史时保留依赖顺序
      targetResumeId?: string | null
      args: unknown
      result?: unknown
      state: AiToolCallState
      undone?: boolean // 该写操作是否已被用户在画布「变更记录」里一键撤销（持久化状态）
    }
  | { type: 'reasoning'; text: string }

export interface AiConversation {
  id: string
  userId: string
  title: string
  resumeId: string | null
  createdAt: string
  updatedAt: string
}

export interface AiConversationSearchResult {
  conversationId: string
  conversationTitle: string
  messageId: string | null
  excerpt: string
  role: 'user' | 'assistant' | null
  matchedAt: string
  conversationUpdatedAt: string
  matchType: 'title' | 'message'
  relevance: number
}

export interface AiMessage {
  id: string
  conversationId: string
  userId: string
  role: AiMessageRole
  parts: AiMessagePart[]
  createdAt: string
}
