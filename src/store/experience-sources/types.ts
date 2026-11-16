import type { StateCreator } from 'zustand'
import type * as api from '@/lib/experience-sources/api'
import type {
  ExperienceSource,
  ExperienceSourceReadResult,
  ExperienceSourceMetadata,
} from '@/lib/experience-sources/types'

export type SourcePage = Awaited<ReturnType<typeof api.listExperienceSources>>

export type SourceMetadataState =
  | { status: 'loading' }
  | { status: 'ready'; source: ExperienceSourceMetadata }
  | { status: 'missing' }
  | { status: 'error'; error: string }

export interface ExperienceStore {
  ownerId: string | null
  generation: number
  revision: number
  pages: Record<string, SourcePage>
  reads: Record<string, ExperienceSourceReadResult>
  stalePages: Record<string, true>
  staleReads: Record<string, true>
  metadata: Record<string, SourceMetadataState>
  resolveMetadata: (sourceIds: string[], refresh?: boolean) => void
  load: (
    query?: string,
    offset?: number,
    refresh?: boolean,
    kind?: 'files' | 'paste',
  ) => Promise<SourcePage>
  read: (
    sourceId: string,
    versionId?: string,
    offset?: number,
    refresh?: boolean,
    blockIds?: string[],
  ) => Promise<ExperienceSourceReadResult>
  originals: Record<string, Blob>
  original: (sourceId: string, versionId: string) => Promise<Blob>
  invalidate: (sourceId?: string) => void
  rename: (sourceId: string, name: string) => Promise<ExperienceSource>
  remove: (sourceId: string, signal?: AbortSignal) => Promise<void>
}

export type ExperienceSlice<K extends keyof ExperienceStore> = StateCreator<
  ExperienceStore,
  [],
  [],
  Pick<ExperienceStore, K>
>
