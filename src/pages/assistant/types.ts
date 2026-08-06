import type { AiConversation, AiMessage, AiToolCallState } from '@/lib/ai/types'

export type { AiConversation, AiMessage }

export interface AssistantRouteState {
  from?: string
}

export interface OpenConversationOptions {
  targetMessageId?: string | null
  closeOverlays?: boolean
}

export type ConversationSearchStatus
  = 'idle'
    | 'loading'
    | 'ready'
    | 'empty'
    | 'error'
    | 'unavailable'

export type CanvasTabKey = 'resume' | 'board' | 'version' | 'changes'

export type CanvasChangeCategory = 'resume' | 'board' | 'version' | 'read'
export type CanvasChangeAction = 'read' | 'create' | 'update' | 'delete' | 'restore'

export type CanvasChangeDetail
  = | { kind: 'diff', before: unknown, after: unknown }
    | { kind: 'summary', text: string }

export interface CanvasChange {
  id: string
  toolName: string
  category: CanvasChangeCategory
  action: CanvasChangeAction
  title: string
  detail?: CanvasChangeDetail
  stat?: { additions: number, deletions: number }
  state: AiToolCallState
  targetTab?: Exclude<CanvasTabKey, 'changes'>
  // 可撤销的写操作载荷（当前支持「修改当前简历字段」）：把 sectionKey 写回 before
  undo?: { sectionKey: string, before: unknown }
}

export interface CanvasModel {
  changes: CanvasChange[]
  writes: CanvasChange[]
  touchedBoard: boolean
  touchedVersion: boolean
  hasWrites: boolean
}
