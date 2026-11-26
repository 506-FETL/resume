import type { ConversationSearchStatus } from '../types'
import type { AiConversationSearchResult } from '@/lib/ai/types'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  isConversationSearchUnavailable,
  searchConversations,
} from '@/lib/supabase/ai/conversations'
import {
  CONVERSATION_SEARCH_DEBOUNCE_MS,
  CONVERSATION_SEARCH_MIN_LENGTH,
  CONVERSATION_SEARCH_PAGE_SIZE,
} from '../const'

function mergeResults(
  current: AiConversationSearchResult[],
  incoming: AiConversationSearchResult[],
) {
  const seen = new Set(
    current.map(
      (result) =>
        `${result.matchType}:${result.conversationId}:${result.messageId ?? 'title'}`,
    ),
  )

  return [
    ...current,
    ...incoming.filter((result) => {
      const key = `${result.matchType}:${result.conversationId}:${result.messageId ?? 'title'}`

      if (seen.has(key)) return false

      seen.add(key)

      return true
    }),
  ]
}

export function useConversationSearch(open: boolean) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AiConversationSearchResult[]>([])
  const [status, setStatus] = useState<ConversationSearchStatus>('idle')
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const nextOffsetRef = useRef(0)
  const requestIdRef = useRef(0)
  const controllerRef = useRef<AbortController | null>(null)

  const runSearch = useCallback(
    async (searchQuery: string, offset = 0, append = false) => {
      const requestId = ++requestIdRef.current

      controllerRef.current?.abort()

      const controller = new AbortController()

      controllerRef.current = controller

      if (append) {
        setLoadingMore(true)
      } else {
        setResults([])
        setHasMore(false)
        setStatus('loading')
      }

      try {
        const next = await searchConversations({
          query: searchQuery,
          limit: CONVERSATION_SEARCH_PAGE_SIZE + 1,
          offset,
          signal: controller.signal,
        })

        if (requestIdRef.current !== requestId) return

        const page = next.slice(0, CONVERSATION_SEARCH_PAGE_SIZE)

        nextOffsetRef.current = offset + page.length
        setResults((current) => (append ? mergeResults(current, page) : page))
        setHasMore(next.length > page.length)
        setStatus(next.length === 0 && !append ? 'empty' : 'ready')
      } catch (error) {
        if (controller.signal.aborted || requestIdRef.current !== requestId)
          return

        setStatus(
          isConversationSearchUnavailable(error) ? 'unavailable' : 'error',
        )

        if (!append) setResults([])

        setHasMore(append)
      } finally {
        if (requestIdRef.current === requestId) setLoadingMore(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (!open) {
      controllerRef.current?.abort()
      requestIdRef.current += 1

      return
    }

    const normalized = query.trim()

    if (normalized.length < CONVERSATION_SEARCH_MIN_LENGTH) {
      controllerRef.current?.abort()
      requestIdRef.current += 1
      setResults([])
      setHasMore(false)
      setStatus('idle')

      return
    }

    controllerRef.current?.abort()
    requestIdRef.current += 1
    nextOffsetRef.current = 0
    setHasMore(false)
    setLoadingMore(false)
    setResults([])
    setStatus('loading')

    const timer = window.setTimeout(() => {
      runSearch(normalized)
    }, CONVERSATION_SEARCH_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
      controllerRef.current?.abort()
    }
  }, [open, query, runSearch])

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return

    const normalized = query.trim()

    if (normalized.length < CONVERSATION_SEARCH_MIN_LENGTH) return

    runSearch(normalized, nextOffsetRef.current, true)
  }, [hasMore, loadingMore, query, runSearch])

  const retry = useCallback(() => {
    const normalized = query.trim()

    if (normalized.length >= CONVERSATION_SEARCH_MIN_LENGTH)
      runSearch(normalized, nextOffsetRef.current, hasMore)
  }, [query, hasMore, runSearch])

  const reset = useCallback(() => {
    controllerRef.current?.abort()
    requestIdRef.current += 1
    setQuery('')
    setResults([])
    setStatus('idle')
    setHasMore(false)
    setLoadingMore(false)
  }, [])

  return {
    query,
    setQuery,
    results,
    status,
    hasMore,
    loadingMore,
    loadMore,
    retry,
    reset,
  }
}
