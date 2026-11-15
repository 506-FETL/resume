import { create } from 'zustand'
import { useExperienceSourcesStore } from '@/store/experience-sources'
import type { ExperienceSourceReference } from '@/lib/experience-sources/types'
import type { ExperienceFilter, ExperienceView } from './types'

interface ExperiencePageStore {
  query: string
  filter: ExperienceFilter
  offset: number
  view: ExperienceView
  sourceId: string | null
  versionId?: string
  blockId?: string
  detailOpen: boolean
  navigationGeneration: number
  listScroll: number
  uploadOpen: boolean
  uploadTab: 'files' | 'paste'
  uploadNavigationGeneration: number | null
  setQuery: (query: string) => void
  setFilter: (filter: ExperienceFilter) => void
  setView: (view: ExperienceView) => void
  select: (sourceId: string, versionId?: string, blockId?: string) => void
  closeDetail: () => void
  setOffset: (offset: number) => void
  setListScroll: (listScroll: number) => void
  openUpload: (tab: 'files' | 'paste') => void
  setUploadOpen: (open: boolean) => void
  finishUpload: (references: ExperienceSourceReference[]) => void
}

const initial = {
  query: '',
  filter: 'all' as const,
  offset: 0,
  view: 'grid' as const,
  sourceId: null,
  versionId: undefined,
  blockId: undefined,
  detailOpen: false,
  navigationGeneration: 0,
  listScroll: 0,
  uploadOpen: false,
  uploadTab: 'files' as const,
  uploadNavigationGeneration: null,
}

export const useExperiencePageStore = create<ExperiencePageStore>(
  (set, get) => ({
    ...initial,
    setQuery: (query) => set({ query, offset: 0 }),
    setFilter: (filter) => set({ filter, offset: 0 }),
    setView: (view) => set({ view }),
    select: (sourceId, versionId, blockId) =>
      set((state) => ({
        sourceId,
        versionId,
        blockId,
        detailOpen: true,
        navigationGeneration: state.navigationGeneration + 1,
      })),
    closeDetail: () =>
      set((state) => ({
        detailOpen: false,
        navigationGeneration: state.navigationGeneration + 1,
      })),
    setOffset: (offset) => set({ offset }),
    setListScroll: (listScroll) => set({ listScroll }),
    openUpload: (uploadTab) =>
      set((state) => ({
        uploadOpen: true,
        uploadTab,
        uploadNavigationGeneration: state.navigationGeneration,
      })),
    setUploadOpen: (uploadOpen) => set({ uploadOpen }),
    finishUpload: (references) => {
      const state = get()
      const reference = references.at(-1)

      if (
        !reference ||
        state.detailOpen ||
        state.uploadNavigationGeneration !== state.navigationGeneration
      )
        return

      set({
        query: '',
        filter: 'all',
        offset: 0,
        sourceId: reference.sourceId,
        versionId: reference.versionId,
        blockId: undefined,
      })
    },
  }),
)

useExperienceSourcesStore.subscribe((state, previous) => {
  if (state.generation !== previous.generation)
    useExperiencePageStore.setState(initial)
})
