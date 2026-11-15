import { FileText } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import type { ResumeDocumentState } from '@/components/resume/pagination/types'
import { buildCommentAnchorDocument } from '@/features/resume-comments/anchors/document'
import AnnotationControls from './annotation-controls'
import { useAnnotationTarget } from './use-annotation-target'
import AnimatedContent from '@/components/motion/animated-content'
import { buildTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import ScaledReadonlyPreview from '@/components/resume/scaled-readonly-preview'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Button } from '@/components/ui/button'
import useAssistantStore from '../../../store'
import { AssistantCanvasPreviewSkeleton } from '@/components/page-skeletons/assistant'
import { useCanvasPreview } from '../../../hooks/use-canvas-preview'

export default function ResumePreview() {
  const { snapshot, status, currentName, previewResumeId, loadedResumeId } =
    useCanvasPreview()

  const rootRef = useRef<HTMLDivElement>(null)

  const [documentState, setDocumentState] = useState<{
    key: string
    state: ResumeDocumentState
  } | null>(null)

  const referenceDate = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const previewData = useMemo(
    () => (snapshot ? buildTemplateResumeData(snapshot) : null),
    [snapshot],
  )

  const anchorModel = useMemo(
    () =>
      snapshot ? buildCommentAnchorDocument(snapshot, referenceDate) : null,
    [snapshot, referenceDate],
  )

  const previewKey = `${loadedResumeId}:${anchorModel?.documentHash}`

  const onDocumentStateChange = useCallback(
    (state: ResumeDocumentState) =>
      setDocumentState({ key: previewKey, state }),
    [previewKey],
  )

  useAnnotationTarget(
    rootRef,
    anchorModel,
    loadedResumeId,
    documentState?.key === previewKey ? documentState.state : null,
  )

  return (
    <div ref={rootRef} className='flex h-full min-h-0 flex-col'>
      <div className='flex shrink-0 items-center gap-2 border-b px-3 py-2 text-sm'>
        <FileText className='size-4 shrink-0 text-muted-foreground' />
        <span className='min-w-0 flex-1 truncate font-medium'>
          {currentName ?? '当前简历'}
        </span>
        {anchorModel && previewData && previewResumeId && (
          <AnnotationControls
            rootRef={rootRef}
            model={anchorModel}
            data={previewData}
            resumeId={previewResumeId}
            name={currentName ?? '当前简历'}
          />
        )}
      </div>
      {/* 用原生溢出容器而非 Radix ScrollArea：后者视口用 display:table，会让内容按自然宽度撑开导致预览无法按容器宽度自适应缩放 */}
      <div
        data-canvas-scroll
        className='min-h-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]'
      >
        <AnimatedContent
          animationKey={status === 'idle' && !previewData ? 'empty' : status}
          className='p-3'
        >
          {status === 'loading' && <AssistantCanvasPreviewSkeleton />}
          {status === 'error' && (
            <div className='space-y-3 py-10 text-center'>
              <p className='text-sm text-muted-foreground'>
                简历加载失败，请重试。
              </p>
              <Button
                variant='outline'
                size='sm'
                onClick={() => useAssistantStore.getState().bumpCanvasRefresh()}
              >
                重新加载
              </Button>
            </div>
          )}
          {(status === 'empty' ||
            (!snapshot && previewData && status === 'idle')) && (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant='icon'>
                  <FileText />
                </EmptyMedia>
                <EmptyTitle>还没有可预览的简历</EmptyTitle>
                <EmptyDescription>
                  先在编辑器打开简历，或让 AI 新建。
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          {snapshot && previewData && status === 'idle' && (
            <ScaledReadonlyPreview
              key={previewKey}
              data={previewData}
              appearance={snapshot}
              projectionReferenceDate={referenceDate}
              onDocumentStateChange={onDocumentStateChange}
            />
          )}
        </AnimatedContent>
      </div>
    </div>
  )
}
