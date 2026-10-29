import type { ResumeDocumentState } from '@/components/resume/pagination/types'
import type {
  PersistedResumeSnapshot,
  ResumeTemplateBinding,
} from '@/lib/schema'
import { RefreshCw } from 'lucide-react'
import { motion } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useCallback, useMemo, useState } from 'react'
import { buildTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import ScaledReadonlyPreview from '@/components/resume/scaled-readonly-preview'
import { Button } from '@/components/ui/button'
import { useResolvedResumeTemplate } from '@/hooks/use-resolved-resume-template'
import { DURATION, EASE } from '@/lib/motion'
import { cn } from '@/lib/utils'

export interface TemplateSwitchPreviewState {
  contentKey: string
  document: ResumeDocumentState
}

interface PreviewFrame {
  contentKey: string
  snapshot: PersistedResumeSnapshot
  binding: ResumeTemplateBinding
  referenceDate: string
}

function Frame({
  frame,
  visible,
  onState,
  onShown,
}: {
  frame: PreviewFrame
  visible: boolean
  onState: (frame: PreviewFrame, state: ResumeDocumentState) => void
  onShown: (frame: PreviewFrame) => void
}) {
  const reduceMotion = useReducedMotion()

  const data = useMemo(
    () =>
      buildTemplateResumeData({
        ...frame.snapshot,
        templateBinding: frame.binding,
      }),
    [frame],
  )

  const onDocumentStateChange = useCallback(
    (state: ResumeDocumentState) => onState(frame, state),
    [frame, onState],
  )

  return (
    <motion.div
      data-template-switch-frame={frame.binding.templateId}
      aria-hidden={!visible}
      inert={!visible}
      initial={{ opacity: reduceMotion ? 1 : 0 }}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{
        duration: reduceMotion ? 0 : DURATION.base,
        ease: EASE.out,
      }}
      onAnimationComplete={() => visible && onShown(frame)}
      className={cn(
        'w-full',
        !visible && 'pointer-events-none absolute inset-x-0 top-0',
      )}
    >
      <ScaledReadonlyPreview
        data={data}
        appearance={frame.snapshot}
        projectionReferenceDate={frame.referenceDate}
        onDocumentStateChange={onDocumentStateChange}
      />
    </motion.div>
  )
}

export default function TemplateSwitchPreview({
  snapshot,
  binding,
  contentKey,
  referenceDate,
  onStateChange,
}: {
  snapshot: PersistedResumeSnapshot
  binding: ResumeTemplateBinding
  contentKey: string
  referenceDate: string
  onStateChange: (state: TemplateSwitchPreviewState) => void
}) {
  const serializedSnapshot = JSON.stringify(snapshot)

  const frame = useMemo<PreviewFrame>(
    () => ({
      contentKey,
      snapshot: JSON.parse(serializedSnapshot),
      binding,
      referenceDate,
    }),
    [contentKey, serializedSnapshot, binding, referenceDate],
  )

  const [previous, setPrevious] = useState<PreviewFrame | null>(null)

  const [prepared, setPrepared] = useState<TemplateSwitchPreviewState | null>(
    null,
  )

  const [retryCount, setRetryCount] = useState(0)
  const { retry } = useResolvedResumeTemplate({ binding })

  const ready =
    prepared?.contentKey === contentKey && prepared.document.status === 'ready'

  const error =
    prepared?.contentKey === contentKey ? prepared.document.error : null

  const onState = useCallback(
    (reported: PreviewFrame, document: ResumeDocumentState) => {
      if (reported.contentKey !== contentKey) return

      const state = { contentKey, document }

      setPrepared(state)
      onStateChange(state)
    },
    [contentKey, onStateChange],
  )

  const onShown = useCallback(
    (shown: PreviewFrame) => {
      if (shown.contentKey === contentKey) setPrevious(shown)
    },
    [contentKey],
  )

  const frames =
    previous && previous.contentKey !== frame.contentKey
      ? [previous, frame]
      : [frame]

  return (
    <div
      className='relative min-h-full'
      data-preview-ready={ready}
      data-testid='template-switch-preview'
    >
      {error && (
        <div
          role='alert'
          className='sticky top-0 z-10 mb-4 flex flex-wrap items-center justify-center gap-2 rounded-lg border bg-background/95 px-4 py-3 text-sm shadow-sm'
        >
          <span>
            {navigator.onLine
              ? '候选模板暂时无法预览'
              : '联网后可使用：此模板资源尚未完整缓存'}
          </span>
          <Button
            size='sm'
            variant='outline'
            onClick={() => {
              retry?.()
              setRetryCount((value) => value + 1)
            }}
          >
            <RefreshCw className='size-3' />
            重试预览
          </Button>
        </div>
      )}
      <div className='relative min-h-64'>
        {frames.map((candidate) => (
          <Frame
            key={`${candidate.contentKey}:${retryCount}`}
            frame={candidate}
            visible={candidate.contentKey === contentKey ? ready : !ready}
            onState={onState}
            onShown={onShown}
          />
        ))}
      </div>
    </div>
  )
}
