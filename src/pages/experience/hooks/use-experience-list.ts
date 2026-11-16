import { useEffect, useState } from 'react'
import { useSourceList } from '@/features/experience-sources/use-source-list'
import { useExperiencePageStore } from '../store'

export function useExperienceList() {
  const query = useExperiencePageStore((state) => state.query)
  const offset = useExperiencePageStore((state) => state.offset)
  const filter = useExperiencePageStore((state) => state.filter)
  const deleting = useExperiencePageStore((state) => state.deleting)
  const [search, setSearch] = useState(query)

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query), 200)

    return () => clearTimeout(timer)
  }, [query])

  return useSourceList(
    search,
    offset,
    !deleting,
    filter === 'all' ? undefined : filter,
  )
}
