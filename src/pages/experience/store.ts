import { create } from 'zustand'
import { toast } from 'sonner'
import { useExperienceSourcesStore } from '@/store/experience-sources'
import type { ExperienceSourceReference } from '@/lib/experience-sources/types'
import type {
  ExperienceFilter,
  ExperienceSourceTarget,
  ExperienceView,
} from './types'

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
  selectionMode: boolean
  selectedSources: ExperienceSourceTarget[]
  deleteOpen: boolean
  deleteTargets: ExperienceSourceTarget[]
  deleting: boolean
  deleteProgress: { completed: number; total: number }
  deleteError: string | null
  setSelectionMode: (selectionMode: boolean) => void
  toggleSource: (source: ExperienceSourceTarget) => void
  togglePage: (sources: ExperienceSourceTarget[]) => void
  clearSelection: () => void
  requestDelete: (sources: ExperienceSourceTarget[]) => void
  setDeleteOpen: (open: boolean) => void
  deleteSources: () => Promise<void>
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
  selectionMode: false,
  selectedSources: [],
  deleteOpen: false,
  deleteTargets: [],
  deleting: false,
  deleteProgress: { completed: 0, total: 0 },
  deleteError: null,
}

export const useExperiencePageStore = create<ExperiencePageStore>(
  (set, get) => ({
    ...initial,
    setQuery: (query) => set({ query, offset: 0, selectedSources: [] }),
    setFilter: (filter) => set({ filter, offset: 0, selectedSources: [] }),
    setView: (view) => set({ view }),
    setSelectionMode: (selectionMode) =>
      set({ selectionMode, selectedSources: [] }),
    toggleSource: ({ id, name }) =>
      set((state) => ({
        selectedSources: state.selectedSources.some((item) => item.id === id)
          ? state.selectedSources.filter((item) => item.id !== id)
          : [...state.selectedSources, { id, name }],
      })),
    togglePage: (sources) => {
      const selected = get().selectedSources
      const pageIds = new Set(sources.map((source) => source.id))
      const selectedIds = new Set(selected.map((source) => source.id))
      const allSelected = sources.every((source) => selectedIds.has(source.id))

      set({
        selectedSources: allSelected
          ? selected.filter((source) => !pageIds.has(source.id))
          : [
              ...selected,
              ...sources
                .filter((source) => !selectedIds.has(source.id))
                .map(({ id, name }) => ({ id, name })),
            ],
      })
    },
    clearSelection: () => set({ selectedSources: [] }),
    requestDelete: (sources) => {
      if (!sources.length || get().deleting) return

      set({
        deleteOpen: true,
        deleteTargets: sources.map(({ id, name }) => ({ id, name })),
        deleteProgress: { completed: 0, total: sources.length },
        deleteError: null,
      })
    },
    setDeleteOpen: (deleteOpen) => {
      if (get().deleting) return

      set({ deleteOpen })
    },
    deleteSources: async () => {
      const targets = get().deleteTargets

      if (get().deleting || !targets.length) return

      const generation = useExperienceSourcesStore.getState().generation
      const controller = new AbortController()

      const unsubscribe = useExperienceSourcesStore.subscribe((state) => {
        if (state.generation !== generation) controller.abort()
      })

      const failed: ExperienceSourceTarget[] = []
      let failureMessage = ''

      set({
        deleting: true,
        deleteError: null,
        deleteProgress: { completed: 0, total: targets.length },
      })

      try {
        for (const [index, target] of targets.entries()) {
          try {
            await useExperienceSourcesStore
              .getState()
              .remove(target.id, controller.signal)
          } catch (error) {
            if (controller.signal.aborted) return

            failed.push(target)

            failureMessage ||=
              error instanceof Error ? error.message : '请稍后重试。'
          }

          if (controller.signal.aborted) return

          set((state) => ({
            selectedSources: failed.some((item) => item.id === target.id)
              ? state.selectedSources
              : state.selectedSources.filter((item) => item.id !== target.id),
            deleteProgress: { completed: index + 1, total: targets.length },
          }))
        }

        const deleted = targets.length - failed.length

        set((state) => ({
          deleteOpen: failed.length > 0,
          deleteTargets: failed.length ? failed : targets,
          deleteError: failed.length
            ? `${deleted ? `已删除 ${deleted} 份资料，` : ''}${failed.length} 份资料需要重试。${failureMessage}`
            : null,
          selectionMode:
            state.selectionMode && state.selectedSources.length > 0,
        }))

        if (!failed.length) toast.success(`已删除 ${deleted} 份资料`)
      } finally {
        unsubscribe()

        if (!controller.signal.aborted) set({ deleting: false })
      }
    },
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
