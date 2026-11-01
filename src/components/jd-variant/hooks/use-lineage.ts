import type { VariantLineage } from '@/lib/supabase/resume/variant'
import { useCallback, useEffect } from 'react'
import { create } from 'zustand'
import {
  fetchOfflineVariantTree,
  isOfflineResumeId,
} from '@/lib/offline-resume-manager'
import { fetchVariantTree } from '@/lib/supabase/resume/variant'
import useUserStore from '@/store/user'
import { subscribeResumeReadChanges } from '@/lib/resume-read-events'
import useResumeListStore from '@/pages/resume/store'

interface LineageResource {
  data: VariantLineage | null
  loading: boolean
  error: string | null
}

interface CacheState {
  byId: Record<string, LineageResource | undefined>
  load: (id: string, force?: boolean) => Promise<void>
  reset: () => void
}

const useLineageCache = create<CacheState>((set, get) => {
  let generation = 0
  const requests = new Map<string, Promise<void>>()

  return {
    byId: {},
    reset: () => {
      generation += 1
      requests.clear()
      set({ byId: {} })
    },
    load: (id, force = false) => {
      const pending = requests.get(id)

      if (pending) return pending
      if (!force && get().byId[id]?.data) return Promise.resolve()

      const scope = generation
      const previous = get().byId[id]?.data ?? null

      const write = (resource: LineageResource) => {
        if (scope === generation)
          set((state) => ({ byId: { ...state.byId, [id]: resource } }))
      }

      write({ data: previous, loading: true, error: null })

      const fetcher = isOfflineResumeId(id)
        ? fetchOfflineVariantTree
        : fetchVariantTree

      const request = fetcher(id)
        .then((data) => {
          write({ data, loading: false, error: null })
        })
        .catch((error) => {
          write({
            data: previous,
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : '读取派生关系失败，请重试',
          })
        })
        .finally(() => {
          if (requests.get(id) === request) requests.delete(id)
        })

      requests.set(id, request)

      return request
    },
  }
})

useUserStore.subscribe((state, previous) => {
  if (state.currentUser?.id !== previous.currentUser?.id)
    useLineageCache.getState().reset()
})

useResumeListStore.subscribe((state, previous) => {
  if (state.resumes !== previous.resumes) useLineageCache.getState().reset()
})

subscribeResumeReadChanges(() => useLineageCache.getState().reset())

export function useVariantLineage(
  rootId: string | null | undefined,
  enabled = true,
) {
  const resource = useLineageCache((state) =>
    rootId ? state.byId[rootId] : undefined,
  )

  const load = useLineageCache((state) => state.load)

  useEffect(() => {
    if (enabled && rootId && !resource) load(rootId)
  }, [enabled, rootId, resource, load])

  const refresh = useCallback(async () => {
    if (rootId) await load(rootId, true)
  }, [rootId, load])

  return {
    tree: resource?.data?.root ?? null,
    lineage: resource?.data ?? null,
    loading: resource?.loading ?? (enabled && Boolean(rootId)),
    error: resource?.error ?? null,
    refresh,
  }
}
