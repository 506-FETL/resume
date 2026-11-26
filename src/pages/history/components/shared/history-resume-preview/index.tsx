import type { RefObject } from 'react'
import type {
  ResumeDocumentState,
  ResumeDocumentStateChange,
} from '@/components/resume/pagination/types'
import type { ResumeSnapshot } from '@/lib/supabase/resume/history'
import {
  memo,
  useCallback,
  use,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { buildTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import ScaledReadonlyPreview from '@/components/resume/scaled-readonly-preview'
import StaticResumePaper from '@/components/resume/static-resume-paper'
import { resolveTemplateReference } from '@/lib/resume-template/binding'
import { templateKey } from '@/lib/resume-template/source/types'
import { useResumeTemplateStore } from '@/store/resume-template'
import { useTemplateImageStore } from '@/store/resume-template/images'
import { HistoryPaperContext, paperViewport } from './paper'

interface HistoryResumePreviewProps {
  projectionReferenceDate?: string
  documentRef: RefObject<HTMLDivElement | null>
  onDocumentStateChange?: ResumeDocumentStateChange
  snapshot: ResumeSnapshot
}

function HistoryResumePreview(props: HistoryResumePreviewProps) {
  const cache = use(HistoryPaperContext)

  const date =
    props.projectionReferenceDate ?? new Date().toISOString().slice(0, 10)

  const [cached, setCached] = useState(() => cache?.paper)

  const paper =
    cached?.snapshot === props.snapshot &&
    cached.projectionDate === date &&
    cached.viewport === paperViewport()
      ? cached
      : undefined

  const { onDocumentStateChange } = props

  useLayoutEffect(() => {
    if (paper) onDocumentStateChange?.(paper.state)
  }, [onDocumentStateChange, paper])

  useEffect(() => {
    if (!paper) return

    const resize = () => {
      if (paper.viewport !== paperViewport()) setCached(undefined)
    }

    const observer = new MutationObserver(resize)

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })

    window.addEventListener('resize', resize)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', resize)
    }
  }, [paper])

  return paper ? (
    <StaticResumePaper paper={paper} documentRef={props.documentRef} />
  ) : (
    <LivePreview {...props} projectionReferenceDate={date} />
  )
}

function LivePreview({
  snapshot,
  projectionReferenceDate,
  documentRef,
  onDocumentStateChange,
}: HistoryResumePreviewProps & { projectionReferenceDate: string }) {
  const cache = use(HistoryPaperContext)

  const latestRef = useRef<{
    state: ResumeDocumentState
    pages: HTMLDivElement
  } | null>(null)

  const previewData = useMemo(
    () => buildTemplateResumeData(snapshot),
    [snapshot],
  )

  const report = useCallback(
    (state: ResumeDocumentState) => {
      latestRef.current = documentRef.current
        ? { state, pages: documentRef.current }
        : null

      onDocumentStateChange?.(state)
    },
    [onDocumentStateChange, documentRef],
  )

  useLayoutEffect(() => {
    return () => {
      const live = latestRef.current

      if (!live) return

      const { pages, state } = live

      if (
        !cache?.active ||
        state?.status !== 'ready' ||
        !pages?.offsetWidth ||
        pages.dataset.paginationStatus !== 'ready'
      )
        return

      const key = templateKey(
        resolveTemplateReference(snapshot.templateBinding),
      )

      const definition = useResumeTemplateStore.getState().definitions[key]

      if (definition?.status !== 'ready') return

      const releases = definition.data.assets.map((asset) =>
        useTemplateImageStore.getState().retain(asset.sha256),
      )

      cache.paper?.release()

      cache.paper = {
        snapshot,
        projectionDate: projectionReferenceDate,
        viewport: paperViewport(),
        pages: pages.cloneNode(true) as HTMLDivElement,
        width: pages.offsetWidth,
        height: pages.offsetHeight,
        state,
        release: () => releases.forEach((release) => release()),
      }
    }
  }, [cache, snapshot, projectionReferenceDate, documentRef])

  return (
    <ScaledReadonlyPreview
      data={previewData}
      documentRef={documentRef}
      onDocumentStateChange={report}
      appearance={snapshot}
      projectionReferenceDate={projectionReferenceDate}
    />
  )
}

export const HistoryPreviewDocument = memo(HistoryResumePreview)

export default HistoryPreviewDocument
