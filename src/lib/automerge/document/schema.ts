import type { PersistedResumeSnapshot } from '@/lib/schema'

/**
 * Automerge 文档结构
 * 扩展自完整持久化快照
 */
export interface AutomergeResumeDocument extends PersistedResumeSnapshot {
  // 文档元数据
  _metadata: {
    resumeId: string
    userId: string
    createdAt: string
    updatedAt: string
    version: number
  }

  // 表单顺序和可见性
  // 协作者信息（运行时状态，不持久化到 Supabase）
  _collaborators?: {
    [userId: string]: {
      name: string
      email: string
      avatarUrl?: string
      color: string
      lastSeen: string
      currentlyEditing?: string[]
    }
  }
}

export type ChangeFn<T> = (doc: T) => void

export type FieldPath = string[]
