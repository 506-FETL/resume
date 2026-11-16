import type { DBSchema } from 'idb'
import type { CommentBootstrapResult } from '../client.ts'

export interface CommentCacheKey {
  versionId: number
  principalKey: string
}

export type CachedCommentBootstrap = Omit<
  CommentBootstrapResult,
  'scopeRealtime' | 'ownerRealtime'
>

export interface CommentCacheEntry {
  protocolVersion: 1
  key: string
  versionId: number
  principalKey: string
  cachedAt: number
  value: CachedCommentBootstrap
}

export interface ResumeCommentCacheSchema extends DBSchema {
  bootstrap: {
    key: string
    value: CommentCacheEntry
    indexes: { principalKey: string }
  }
}

export interface CommentCacheWriteFence {
  generation: number
}
