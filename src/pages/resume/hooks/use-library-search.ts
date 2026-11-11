import { useEffect, useState } from 'react'
import { useDebouncedValue } from '@/hooks/use-debounce'
import useResumeListStore from '../store'
import { RESUME_SEARCH_DELAY_MS } from '../const'

export function useLibrarySearch() {
  const input = useResumeListStore((state) => state.librarySearchInput)
  const setInput = useResumeListStore((state) => state.setLibrarySearchInput)
  const setQuery = useResumeListStore((state) => state.setLibraryQuery)
  const [composing, setComposing] = useState(false)
  const debounced = useDebouncedValue(input, RESUME_SEARCH_DELAY_MS)

  useEffect(() => {
    if (composing || debounced !== input) return

    setQuery(debounced)
  }, [composing, debounced, input, setQuery])

  function changeInput(value: string) {
    setInput(value)

    if (!composing && !value.trim()) setQuery('')
  }

  function finishComposition(value: string) {
    setInput(value)
    setComposing(false)

    if (!value.trim()) setQuery('')
  }

  return { input, changeInput, setComposing, finishComposition }
}
