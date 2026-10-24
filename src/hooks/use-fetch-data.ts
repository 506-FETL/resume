import type { DependencyList } from 'react'
import { useEffect, useRef, useState } from 'react'

export interface UseFetchDataState<T> {
  data: T | null
  loading: boolean
  error: unknown
}

export interface UseFetchDataResult<T> extends UseFetchDataState<T> {
  /** Manually trigger a refetch (cancels any in-flight call). */
  refetch: () => void
  /** Imperatively set data (e.g., after optimistic update). */
  setData: (next: T | null) => void
}

/**
 * Generic data fetcher that mirrors the common
 * `useEffect + useState(loading) + .catch` pattern used across pages.
 *
 * - Accepts an `AbortSignal` so callers can cancel fetches when supported.
 * - Discards results from stale invocations (cancellation guard).
 * - Re-runs when any dependency in `deps` changes.
 */
export function useFetchData<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: DependencyList,
): UseFetchDataResult<T> {
  const [state, setState] = useState<UseFetchDataState<T>>({
    data: null,
    loading: true,
    error: null,
  })

  const tickRef = useRef(0)

  // We deliberately track only the primitive trigger; consumers pass real deps.
  const [trigger, setTrigger] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    const myTick = ++tickRef.current
    setState((prev) => ({ ...prev, loading: true, error: null }))

    fetcher(controller.signal)
      .then((data) => {
        if (myTick !== tickRef.current) return
        setState({ data, loading: false, error: null })
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        if (myTick !== tickRef.current) return
        setState({ data: null, loading: false, error })
      })

    return () => {
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, trigger])

  return {
    ...state,
    refetch: () => setTrigger((t) => t + 1),
    setData: (next) => setState((prev) => ({ ...prev, data: next })),
  }
}
