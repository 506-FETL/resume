import { create } from 'zustand'
import useUserStore from '@/store/user'
import type { ExperienceStore } from './types'
import { pending, metadataQueue, unknownDeletions } from './runtime'
import { createMetadataSlice } from './metadata'
import { createReadsSlice } from './reads'
import { createMutationsSlice } from './mutations'

export { getCachedSourcePage } from './page-cache'

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

useUserStore.subscribe((state) => {
  const ownerId = state.currentUser?.id ?? null

  if (ownerId === useExperienceSourcesStore.getState().ownerId) return

  pending.clear()
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
