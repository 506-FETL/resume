import { useEffect, useState } from 'react'
import { useStore } from 'zustand'
import { useDebouncedValue } from '@/hooks/use-debounce'
import useUserStore from '@/store/user'
import { SHARE_OPTION_PAGE_SIZE } from '@/lib/supabase/resume/share/option-pages'
import type { createOptionPages } from '../store/data/option-pages'

export function useOptionPage<T>(
  pages: ReturnType<typeof createOptionPages<T>>,
  target: string,
  enabled: boolean,
  read: (target: string, keyword: string, offset: number) => Promise<T[]>,
) {
  const ownerId = useUserStore((state) => state.currentUser?.id)
  const [search, setSearch] = useState('')
  const [composing, setComposing] = useState(false)
  const [page, setPage] = useState(0)
  const keyword = search.trim()
  const settled = useDebouncedValue(keyword, 200)
  const key = JSON.stringify([ownerId, target, keyword, page])
  const result = useStore(pages.store, (entries) => entries.get(key))
  const ready = enabled && !!ownerId && !composing && settled === keyword

  useEffect(() => {
    if (ready && !result)
      pages.load(key, () =>
        read(target, keyword, page * SHARE_OPTION_PAGE_SIZE),
      )
  }, [key, ready, result, pages, read, target, keyword, page])

  return {
    search,
    onSearch(value: string) {
      setSearch(value)
      setPage(0)
    },
    setComposing,
    page,
    setPage,
    items: result?.items?.slice(0, SHARE_OPTION_PAGE_SIZE) ?? [],
    more: (result?.items?.length ?? 0) > SHARE_OPTION_PAGE_SIZE,
    loading: !result?.items && !result?.error,
    error: Boolean(result?.error),
    retry() {
      if (ready)
        pages.load(
          key,
          () => read(target, keyword, page * SHARE_OPTION_PAGE_SIZE),
          true,
        )
    },
  }
}
