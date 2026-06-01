import type { VariantLineage } from '@/lib/supabase/resume/variant'
import { useCallback, useEffect, useState } from 'react'
import { create } from 'zustand'
import { fetchOfflineVariantTree, isOfflineResumeId } from '@/lib/offline-resume-manager'
import { fetchVariantTree } from '@/lib/supabase/resume/variant'

interface CacheState {
  byId: Record<string, VariantLineage | undefined>
  set: (id: string, lineage: VariantLineage) => void
  invalidate: (id: string) => void
}

const useLineageCache = create<CacheState>(set => ({
  byId: {},
  set: (id, lineage) => set(s => ({ byId: { ...s.byId, [id]: lineage } })),
  invalidate: id => set((s) => {
    const next = { ...s.byId }
    delete next[id]
    return { byId: next }
  }),
}))

export function useVariantLineage(rootId: string | null | undefined) {
  const cached = useLineageCache(s => (rootId ? s.byId[rootId] : undefined))
  const setCache = useLineageCache(s => s.set)
  const invalidate = useLineageCache(s => s.invalidate)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const fetcher = isOfflineResumeId(id) ? fetchOfflineVariantTree : fetchVariantTree
      const lineage = await fetcher(id)
      setCache(id, lineage)
    }
    catch (e) {
      setError(e instanceof Error ? e.message : 'lineage fetch failed')
    }
    finally {
      setLoading(false)
    }
  }, [setCache])

  useEffect(() => {
    if (!rootId || cached) {
      return
    }
    load(rootId)
  }, [rootId, cached, load])

  const refresh = useCallback(async () => {
    if (!rootId) {
      return
    }
    invalidate(rootId)
    await load(rootId)
  }, [rootId, invalidate, load])

  return { tree: cached?.root ?? null, lineage: cached ?? null, loading, error, refresh }
}
