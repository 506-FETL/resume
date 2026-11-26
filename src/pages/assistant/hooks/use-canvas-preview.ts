import { useEffect, useRef, useState } from 'react'
import { isResumeNotFoundError } from '@/lib/resume-id'
import useCurrentResumeStore from '@/store/resume/current'
import useUserStore from '@/store/user'
import useAssistantStore from '../store'
import {
  invalidateCanvasSnapshot,
  useCanvasResources,
} from './canvas-resources'
import { type CanvasResume, loadCanvasResume } from './canvas-resume'

export { invalidateCanvasSnapshot } from './canvas-resources'

export function useCanvasPreview() {
  const owner = useUserStore((s) => s.currentUser?.id)
  const generation = useCanvasResources((s) => s.generation)
  const revision = useCanvasResources((s) => s.resumeRevision)
  const current = useCurrentResumeStore((s) => s.resumeId)
  const explicit = useAssistantStore((s) => s.explicitPreviewResumeId)
  const refresh = useAssistantStore((s) => s.canvasRefreshTick)
  const lastRefreshRef = useRef(refresh)

  const visible = useAssistantStore(
    (s) =>
      s.canvasActiveTab === 'resume' &&
      (s.layoutMode === 'drawer' ? s.canvasMobileOpen : s.canvasOpen),
  )

  const waiting = useAssistantStore(
    (s) => s.initializing && !s.pendingConversationId,
  )

  const bound = useAssistantStore(
    (s) =>
      s.conversations.find(
        (row) => row.id === (s.pendingConversationId ?? s.activeConversationId),
      )?.resumeId,
  )

  const [view, setView] = useState<{
    generation: number
    resume?: CanvasResume | null
    error?: boolean
  }>({ generation })

  useEffect(() => {
    if (lastRefreshRef.current === refresh) return

    lastRefreshRef.current = refresh

    invalidateCanvasSnapshot(
      useAssistantStore.getState().previewResumeId ?? undefined,
    )
  }, [refresh])

  useEffect(() => {
    if (!visible || !owner || (waiting && !explicit)) return

    let active = true
    const previous = useAssistantStore.getState().previewResumeId

    const targets = explicit
      ? [explicit]
      : [
          ...new Set(
            [bound, current, previous].filter((id): id is string =>
              Boolean(id),
            ),
          ),
          null,
        ]

    const owns = () =>
      active && useCanvasResources.getState().generation === generation

    setView((value) =>
      value.generation === generation &&
      value.resume &&
      targets[0] === value.resume.id
        ? { generation, resume: value.resume }
        : { generation },
    )

    async function load() {
      for (const target of targets) {
        try {
          const resume = await loadCanvasResume(owner!, target)

          if (!owns()) return

          useAssistantStore.getState().setPreviewResumeId(resume?.id ?? null)
          setView({ generation, resume })

          return
        } catch (error) {
          if (!owns()) return
          if (explicit || !target || !isResumeNotFoundError(error)) throw error
          if (target === current)
            useCurrentResumeStore.getState().clearCurrentResume()
        }
      }
    }

    load().catch((error: unknown) => {
      if (owns())
        setView((value) => ({
          generation,
          resume: isResumeNotFoundError(error) ? undefined : value.resume,
          error: true,
        }))
    })

    return () => {
      active = false
    }
  }, [owner, generation, revision, visible, current, explicit, bound, waiting])

  const owned = view.generation === generation
  const resume = owned ? view.resume : undefined

  const status =
    owned && view.error && !resume
      ? 'error'
      : resume === undefined
        ? 'loading'
        : resume
          ? 'idle'
          : 'empty'

  return {
    status,
    resume,
    refreshFailed: Boolean(owned && view.error && resume),
  }
}
