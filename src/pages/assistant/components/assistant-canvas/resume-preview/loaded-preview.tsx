import { useCallback, useMemo, useRef, useState } from 'react'
import type { ResumeDocumentState } from '@/components/resume/pagination/types'
import { buildCommentAnchorDocument } from '@/features/resume-comments/anchors/document'
import AnnotationControls from './annotation-controls'
import { useAnnotationTarget } from './use-annotation-target'
import { buildTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import ScaledReadonlyPreview from '@/components/resume/scaled-readonly-preview'
import type { CanvasResume } from '../../../hooks/canvas-resume'
import { PreviewHeader } from './preview-header'

export default function LoadedPreview({
  snapshot,
  id,
  name,
}: Pick<CanvasResume, 'snapshot' | 'id' | 'name'>) {
  const rootRef = useRef<HTMLDivElement>(null)

  const [documentState, setDocumentState] = useState<{
    key: string
    state: ResumeDocumentState
  } | null>(null)

  const referenceDate = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const previewData = useMemo(
    () => buildTemplateResumeData(snapshot),
    [snapshot],
  )

  const anchorModel = useMemo(
    () => buildCommentAnchorDocument(snapshot, referenceDate),
    [snapshot, referenceDate],
  )

  const previewKey = `${id}:${anchorModel?.documentHash}`

  const onDocumentStateChange = useCallback(
    (state: ResumeDocumentState) =>
      setDocumentState({ key: previewKey, state }),
    [previewKey],
  )

  useAnnotationTarget(
    rootRef,
    anchorModel,
    id,
    documentState?.key === previewKey ? documentState.state : null,
  )

  const guidePreviewStatus =
    documentState?.key === previewKey ? documentState.state.status : 'loading'

  return (
    <div
      ref={rootRef}
      data-feature-guide-canvas-resume={
        guidePreviewStatus === 'ready' ? '' : undefined
      }
      data-feature-guide-preview-status={guidePreviewStatus}
      className='flex h-full min-h-0 flex-col'
    >
      <PreviewHeader name={name}>
        <AnnotationControls
          rootRef={rootRef}
          model={anchorModel}
          data={previewData}
          resumeId={id}
          name={name}
        />
      </PreviewHeader>
      <div
        data-canvas-scroll
        className='min-h-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]'
      >
        <div className='p-3'>
          <ScaledReadonlyPreview
            key={previewKey}
            data={previewData}
            appearance={snapshot}
            projectionReferenceDate={referenceDate}
            onDocumentStateChange={onDocumentStateChange}
          />
        </div>
      </div>
    </div>
  )
}
