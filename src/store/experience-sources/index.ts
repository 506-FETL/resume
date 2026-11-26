import { create } from 'zustand'
import useUserStore from '@/store/user'
import type { ExperienceStore } from './types'
import {
  pending,
  metadataQueue,
  unknownDeletions,
  sourceReadKey,
  sourceRequestKey,
} from './runtime'
import { createMetadataSlice } from './metadata'
import { createReadsSlice } from './reads'
import { createMutationsSlice } from './mutations'
import { clearExperiencePreload, prepareExperienceRequest } from './preload'

export { getCachedSourcePage } from './page-cache'

export { clearExperiencePreload } from './preload'

export type { SourceMetadataState } from './types'

export const useExperienceSourcesStore = create<ExperienceStore>((...args) => ({
  ownerId: useUserStore.getState().currentUser?.id ?? null,
  generation: 0,
  revision: 0,
  pages: {},
  originals: {},
  reads: {},
  stalePages: {},
  staleReads: {},
  metadata: {},
  ...createMetadataSlice(...args),
  ...createReadsSlice(...args),
  ...createMutationsSlice(...args),
}))

export function preloadExperienceList(
  query = '',
  offset = 0,
  kind?: 'files' | 'paste',
) {
  const state = useExperienceSourcesStore.getState()

  const key = sourceRequestKey(
    state,
    'list',
    JSON.stringify([query, offset, kind]),
  )

  return prepareExperienceRequest(key, () =>
    state.load(query, offset, false, kind),
  )
}

export function preloadExperienceRead(
  sourceId: string,
  versionId?: string,
  offset = 0,
) {
  const state = useExperienceSourcesStore.getState()

  const key = sourceRequestKey(
    state,
    'read',
    sourceReadKey(sourceId, versionId, offset),
  )

  return prepareExperienceRequest(key, () =>
    state.read(sourceId, versionId, offset),
  )
}

useUserStore.subscribe((state) => {
  const ownerId = state.currentUser?.id ?? null

  if (ownerId === useExperienceSourcesStore.getState().ownerId) return

  pending.clear()
  clearExperiencePreload()
  metadataQueue.clear()
  unknownDeletions.clear()

  useExperienceSourcesStore.setState((current) => ({
    ownerId,
    generation: current.generation + 1,
    revision: current.revision + 1,
    pages: {},
    originals: {},
    reads: {},
    stalePages: {},
    staleReads: {},
    metadata: {},
  }))
})
