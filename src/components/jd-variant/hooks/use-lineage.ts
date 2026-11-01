import type { VariantLineage } from '@/lib/supabase/resume/variant'
import { useCallback, useEffect, useState } from 'react'
import { create } from 'zustand'
import {
  fetchOfflineVariantTree,
  isOfflineResumeId,
} from '@/lib/offline-resume-manager'
import { fetchVariantTree } from '@/lib/supabase/resume/variant'

interface CacheState {
  byId: Record<string, VariantLineage | undefined>
  set: (id: string, lineage: VariantLineage) => void
}

const useLineageCache = create<CacheState>((set) => ({
  byId: {},
  set: (id, lineage) => set((s) => ({ byId: { ...s.byId, [id]: lineage } })),
}))

export function useVariantLineage(
  rootId: string | null | undefined,
  enabled = true,
) {
  const cached = useLineageCache((s) => (rootId ? s.byId[rootId] : undefined))
  const setCache = useLineageCache((s) => s.set)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (id: string) => {
      setLoading(true)
      setError(null)

      try {
        const fetcher = isOfflineResumeId(id)
          ? fetchOfflineVariantTree
          : fetchVariantTree

        const lineage = await fetcher(id)

        setCache(id, lineage)
      } catch (e) {
        setError(e instanceof Error ? e.message : '读取派生关系失败，请重试')
      } finally {
        setLoading(false)
      }
    },
    [setCache],
  )

  useEffect(() => {
    if (!enabled || !rootId || cached) {
      return
    }

    load(rootId)
  }, [enabled, rootId, cached, load])

  const refresh = useCallback(async () => {
    if (!rootId) {
      return
    }

    await load(rootId)
  }, [rootId, load])

  return {
    tree: cached?.root ?? null,
    lineage: cached ?? null,
    loading: loading || (enabled && Boolean(rootId) && !cached && !error),
    error,
    refresh,
  }
}
