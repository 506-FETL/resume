import { useEffect, useState } from 'react'
import { useSourceList } from '@/features/experience-sources/use-source-list'
import { useExperiencePageStore } from '../store'

export function useExperienceList() {
  const query = useExperiencePageStore((state) => state.query)
  const offset = useExperiencePageStore((state) => state.offset)
  const filter = useExperiencePageStore((state) => state.filter)
  const deleting = useExperiencePageStore((state) => state.deleting)
  const uploadOpen = useExperiencePageStore((state) => state.uploadOpen)
  const detailOpen = useExperiencePageStore((state) => state.detailOpen)
  const [search, setSearch] = useState(query)

  useEffect(() => {
    if (search === query) return

    const timer = setTimeout(() => setSearch(query), 200)

    return () => clearTimeout(timer)
  }, [query, search])

  const pendingSearch = query !== search

  const result = useSourceList(
    search,
    offset,
    !deleting && !detailOpen && !uploadOpen && !pendingSearch,
    filter === 'all' ? undefined : filter,
  )

  return pendingSearch
    ? { ...result, page: undefined, error: null, loading: true }
    : result
}
