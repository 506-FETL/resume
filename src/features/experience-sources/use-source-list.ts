import { useEffect, useMemo, useRef, useState } from 'react'
import {
  getCachedSourcePage,
  useExperienceSourcesStore,
} from '@/store/experience-sources'
import { experienceError } from './utils'

export function useSourceList(
  query: string,
  offset = 0,
  enabled = true,
  kind?: 'files' | 'paste',
) {
  const generation = useExperienceSourcesStore((state) => state.generation)
  const revision = useExperienceSourcesStore((state) => state.revision)

  const pages = useExperienceSourcesStore((state) => state.pages)
  const stalePages = useExperienceSourcesStore((state) => state.stalePages)

  const page = useMemo(
    () => getCachedSourcePage({ pages, stalePages }, query, offset, kind),
    [pages, stalePages, query, offset, kind],
  )

  const fallback = pages[JSON.stringify([query, offset, kind])]
  const stale = !page && !!fallback

  const identity = JSON.stringify([generation, query, offset, kind])

  const [errorState, setErrorState] = useState<{
    identity: string
    message: string
  } | null>(null)

  const error = errorState?.identity === identity ? errorState.message : null
  const [loadingState, setLoadingState] = useState({ identity, busy: false })
  const loading = loadingState.identity === identity && loadingState.busy
  const [attempt, setAttempt] = useState(0)
  const previousAttemptRef = useRef(0)

  useEffect(() => {
    if (!enabled) return

    let active = true
    const refresh = attempt !== previousAttemptRef.current

    previousAttemptRef.current = attempt

    const cached =
      !refresh &&
      getCachedSourcePage(
        useExperienceSourcesStore.getState(),
        query,
        offset,
        kind,
      )

    setLoadingState({ identity, busy: !cached })
    setErrorState(null)

    useExperienceSourcesStore
      .getState()
      .load(query, offset, refresh, kind)
      .catch((cause) => {
        if (active) setErrorState({ identity, message: experienceError(cause) })
      })
      .finally(() => {
        if (active) setLoadingState({ identity, busy: false })
      })

    return () => {
      active = false
    }
  }, [query, offset, enabled, revision, generation, attempt, kind, identity])

  return {
    page: page ?? fallback,
    stale,
    error,
    loading: loading || (enabled && !page && !error),
    retry: () => setAttempt((value) => value + 1),
  }
}
