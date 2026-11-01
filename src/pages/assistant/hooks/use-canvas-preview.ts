import type { ResumeSnapshot } from '@/lib/supabase/resume/history'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'
import { isResumeNotFoundError } from '@/lib/resume-id'
import useCurrentResumeStore from '@/store/resume/current'
import useAssistantStore from '../store'
import {
  invalidateCanvasSnapshot,
  loadCanvasOptions,
  loadCanvasSnapshot,
  useCanvasResources,
} from './canvas-resources'

export { invalidateCanvasSnapshot } from './canvas-resources'

interface ResumeOption {
  resumeId: string
  name: string
  updatedAt?: string
}

export function useCanvasPreview() {
  const isMobile = useIsMobile()

  const canvasVisible = useAssistantStore((state) =>
    isMobile ? state.canvasMobileOpen : state.canvasOpen,
  )

  const {
    previewResumeId,
    setPreviewResumeId,
    canvasRefreshTick,
    canvasActiveTab,
    activeConversationId,
    conversations,
  } = useAssistantStore()

  const { generation, resumeRevision } = useCanvasResources()
  const currentResumeId = useCurrentResumeStore((state) => state.resumeId)

  const clearCurrentResume = useCurrentResumeStore(
    (state) => state.clearCurrentResume,
  )

  const [options, setOptions] = useState<ResumeOption[]>([])
  const [optionsReady, setOptionsReady] = useState(false)
  const [snapshot, setSnapshot] = useState<ResumeSnapshot | null>(null)
  const [loadedGeneration, setLoadedGeneration] = useState(generation)

  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'empty'>(
    'loading',
  )

  const optionsLoadingRef = useRef(false)
  const lastRefreshRef = useRef(canvasRefreshTick)
  const active = canvasVisible && canvasActiveTab === 'resume'

  const boundResumeId = useMemo(
    () =>
      conversations.find(
        (conversation) => conversation.id === activeConversationId,
      )?.resumeId ?? null,
    [conversations, activeConversationId],
  )

  useEffect(() => {
    if (lastRefreshRef.current === canvasRefreshTick) return

    lastRefreshRef.current = canvasRefreshTick
    invalidateCanvasSnapshot(previewResumeId ?? undefined)
  }, [canvasRefreshTick, previewResumeId])

  useEffect(() => {
    setOptions([])
    setSnapshot(null)
    setOptionsReady(false)
    setStatus('loading')
    setLoadedGeneration(generation)
  }, [generation])

  useEffect(() => {
    if (!active) return

    let cancelled = false

    optionsLoadingRef.current = true
    setOptionsReady(false)

    loadCanvasOptions()
      .then((rows) => {
        if (
          cancelled ||
          generation !== useCanvasResources.getState().generation
        )
          return

        const list = rows.map((resume) => ({
          resumeId: resume.resume_id,
          name: resume.display_name ?? '未命名',
          updatedAt: resume.updated_at,
        }))

        const availableIds = new Set(list.map((option) => option.resumeId))

        const hasCurrent = Boolean(
          currentResumeId && availableIds.has(currentResumeId),
        )

        if (currentResumeId && !hasCurrent) clearCurrentResume()

        const previousPreviewId = useAssistantStore.getState().previewResumeId

        const target =
          boundResumeId && availableIds.has(boundResumeId)
            ? boundResumeId
            : hasCurrent
              ? currentResumeId
              : previousPreviewId && availableIds.has(previousPreviewId)
                ? previousPreviewId
                : (list[0]?.resumeId ?? null)

        optionsLoadingRef.current = false
        setOptions(list)
        setOptionsReady(true)
        setPreviewResumeId(target)

        if (!target) {
          setSnapshot(null)
          setStatus('empty')
        }
      })
      .catch(() => {
        if (
          cancelled ||
          generation !== useCanvasResources.getState().generation
        )
          return

        optionsLoadingRef.current = false
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [
    active,
    boundResumeId,
    currentResumeId,
    generation,
    resumeRevision,
    clearCurrentResume,
    setPreviewResumeId,
  ])

  useEffect(() => {
    if (
      !active ||
      !optionsReady ||
      optionsLoadingRef.current ||
      !previewResumeId
    )
      return

    const option = options.find((item) => item.resumeId === previewResumeId)

    if (!option) return

    let cancelled = false

    setStatus('loading')

    loadCanvasSnapshot(previewResumeId, option.updatedAt)
      .then((next) => {
        if (
          cancelled ||
          generation !== useCanvasResources.getState().generation
        )
          return

        setSnapshot(next)
        setStatus('idle')
      })
      .catch((error) => {
        if (
          cancelled ||
          generation !== useCanvasResources.getState().generation
        )
          return

        setSnapshot(null)
        setStatus(isResumeNotFoundError(error) ? 'empty' : 'error')

        if (isResumeNotFoundError(error)) {
          setOptions((current) =>
            current.filter((item) => item.resumeId !== previewResumeId),
          )

          setPreviewResumeId(null)

          if (currentResumeId === previewResumeId) clearCurrentResume()
        }
      })

    return () => {
      cancelled = true
    }
  }, [
    active,
    options,
    optionsReady,
    previewResumeId,
    generation,
    resumeRevision,
    currentResumeId,
    clearCurrentResume,
    setPreviewResumeId,
  ])

  const ownsData = generation === loadedGeneration

  const currentName =
    options.find((option) => option.resumeId === previewResumeId)?.name ?? null

  return {
    previewResumeId,
    options: ownsData ? options : [],
    snapshot: ownsData ? snapshot : null,
    status: ownsData ? status : ('loading' as const),
    currentName: ownsData ? currentName : null,
  }
}
