import type { AiConversation, AiMessage, AiToolCallState } from '@/lib/ai/types'
import type { KeyboardEvent, ReactNode, RefObject } from 'react'

export type { AiConversation, AiMessage }

export interface ComposerTool {
  name: string
  displayName?: string
  category: string
  description?: string
  icon?: ReactNode
  skillId?: string
  sourceLabel?: string
  aliases?: string[]
}

export interface ComposerSkill {
  id: string
  displayName: string
}

export interface ComposerSkillPickerProps {
  skills: ComposerSkill[]
  disabled?: boolean
  onRemove: (id: string) => void
  label?: string
}

export interface ComposerResumeReference {
  resumeId: string
  name: string
}

export interface ComposerJobReference {
  id: string
  company: string
  position: string
}

export interface ComposerReferenceState<T> {
  generation: number
  items: T[]
  status: 'idle' | 'loading' | 'ready' | 'error'
}

export interface ComposerContextResult {
  resumes: ComposerReferenceState<ComposerResumeReference>
  jobs: ComposerReferenceState<ComposerJobReference>
  retryResumes: () => void
  retryJobs: () => void
}

export interface ComposerToolsProps {
  tools: ComposerTool[]
  query: string
  onQueryChange: (query: string) => void
  queryMode: boolean
  commandRef: RefObject<HTMLDivElement | null>
  textareaRef: RefObject<HTMLTextAreaElement | null>
  onSelect: (tool: ComposerTool) => void
  onClose: () => void
  onRestoreFocus: () => void
}

export interface ComposerCommandAccessibilityProps {
  commandRef: RefObject<HTMLDivElement | null>
  textareaRef: RefObject<HTMLTextAreaElement | null>
  queryMode: boolean
}

export interface ComposerReferencePickerProps {
  context: ComposerContextResult
  disabled: boolean
  onSelect: (token: string, label: string) => void
  textareaRef: RefObject<HTMLTextAreaElement | null>
}

export type ComposerKeyDownEvent = KeyboardEvent<HTMLTextAreaElement>

export interface AssistantRouteState {
  from?: string
}

export interface OpenConversationOptions {
  targetMessageId?: string | null
  closeOverlays?: boolean
}

export type ConversationSearchStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'empty'
  | 'error'
  | 'unavailable'

export type AssistantLayoutMode = 'split' | 'drawer'

export type CanvasTabKey = 'resume' | 'board' | 'version' | 'changes'

export type CanvasChangeCategory = 'resume' | 'board' | 'version' | 'read'

export type CanvasChangeAction =
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'restore'

export type CanvasChangeDetail =
  | { kind: 'diff'; before: unknown; after: unknown }
  | { kind: 'summary'; text: string }

export interface CanvasChange {
  id: string
  toolName: string
  category: CanvasChangeCategory
  action: CanvasChangeAction
  title: string
  detail?: CanvasChangeDetail
  stat?: { additions: number; deletions: number }
  state: AiToolCallState
  targetTab?: Exclude<CanvasTabKey, 'changes'>
  // 该变更所属简历（用于画布按「当前预览简历」隔离变更记录）。看板 / 读操作可无。
  resumeId?: string
  // 可撤销的写操作载荷（当前支持「修改当前简历字段」）：把 sectionKey 写回 before
  undo?: { sectionKey: string; before: unknown }
  // 是否已被一键撤销（源自 tool-call part 的持久化标记，刷新后仍保留）
  undone?: boolean
}

export interface CanvasModel {
  changes: CanvasChange[]
  writes: CanvasChange[]
  touchedBoard: boolean
  touchedVersion: boolean
  hasWrites: boolean
}
