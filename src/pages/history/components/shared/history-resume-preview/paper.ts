import type { ResumeDocumentState } from '@/components/resume/pagination/types'
import type { ResumeSnapshot } from '@/lib/supabase/resume/history'
import { createContext, useLayoutEffect, useMemo } from 'react'

export interface HistoryPaper {
  snapshot: ResumeSnapshot
  projectionDate: string
  viewport: string
  pages: HTMLDivElement
  width: number
  height: number
  state: ResumeDocumentState
  release: () => void
}

interface PaperCache {
  resumeId: string
  active: boolean
  paper?: HistoryPaper
}

export const HistoryPaperContext = createContext<PaperCache | null>(null)

export function useHistoryPaperCache(resumeId: string) {
  const cache = useMemo<PaperCache>(
    () => ({ active: true, resumeId }),
    [resumeId],
  )

  useLayoutEffect(() => {
    cache.active = true

    return () => {
      cache.active = false
      cache.paper?.release()
      cache.paper = undefined
    }
  }, [cache])

  return cache
}

export function paperViewport() {
  return [
    window.innerWidth,
    window.devicePixelRatio,
    document.documentElement.classList.contains('dark'),
  ].join(':')
}
