import type { PersistedResumeSnapshot, VariantMetadata } from '@/lib/schema'
import type { StoreApi } from 'zustand'
import type { JdVariantStore, VariantTask } from '../types'
import { makeIdleTask } from '../types'

export type SetState = StoreApi<JdVariantStore>['setState']

export type GetState = StoreApi<JdVariantStore>['getState']

export const controllers = new Map<string, AbortController>()

export function makePatch(set: SetState) {
  return (parentResumeId: string, partial: Partial<VariantTask>) => {
    set((s) => ({
      tasks: {
        ...s.tasks,
        [parentResumeId]: {
          ...(s.tasks[parentResumeId] ?? makeIdleTask(parentResumeId)),
          ...partial,
        },
      },
    }))
  }
}

export interface OfflineResumeRecord {
  resume_id: string
  display_name?: string
  data: PersistedResumeSnapshot
  derived_metadata?: VariantMetadata | null
}

export interface CloudResumeRecord extends PersistedResumeSnapshot {
  derived_metadata?: VariantMetadata | null
  resume_id: string
  display_name?: string
}

export function computeDepth(
  root: {
    resumeId: string
    children: { resumeId: string; children: unknown[] }[]
  },
  targetId: string,
  d = 0,
): number {
  if (root.resumeId === targetId) return d

  for (const c of root.children) {
    const r = computeDepth(c as typeof root, targetId, d + 1)

    if (r >= 0) return r
  }

  return -1
}
