import type { PersistedResumeSnapshot } from '@/lib/schema'
import type { ResumeDocumentState } from '@/components/resume/pagination/types'
import { useCallback, useEffect, useMemo, useState } from 'react'
import ScaledReadonlyPreview from '@/components/resume/scaled-readonly-preview'
import { buildTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useResolvedResumeTemplate } from '@/hooks/use-resolved-resume-template'
import { DURATION } from '@/lib/motion'
import { getAccessibleResumeById } from '@/lib/resume-access'
import { mapSourceToPersistedSnapshot } from '@/store/resume/helpers/transform'

type SnapshotState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; snapshot: PersistedResumeSnapshot }

export default function ResumeThumbnail({ resumeId }: { resumeId: string }) {
  const [state, setState] = useState<SnapshotState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true

    setState({ status: 'loading' })

    getAccessibleResumeById(resumeId)
      .then((source) => {
        const snapshot = mapSourceToPersistedSnapshot(source)

        if (active) setState({ status: 'ready', snapshot })
      })
      .catch(() => {
        if (active) setState({ status: 'error' })
      })

    return () => {
      active = false
    }
  }, [resumeId, attempt])

  function retry() {
    setAttempt((value) => value + 1)
  }

  if (state.status !== 'ready')
    return <PreviewStatus error={state.status === 'error'} onRetry={retry} />

  return <PreviewDocument snapshot={state.snapshot} onRetry={retry} />
}

function PreviewDocument({
  snapshot,
  onRetry,
}: {
  snapshot: PersistedResumeSnapshot
  onRetry: () => void
}) {
  const reduceMotion = useReducedMotion()
  const data = useMemo(() => buildTemplateResumeData(snapshot), [snapshot])

  const template = useResolvedResumeTemplate({
    binding: snapshot.templateBinding,
  })

  const [documentState, setDocumentState] =
    useState<ResumeDocumentState | null>(null)

  const setMeasurementSource = useCallback((source: HTMLDivElement | null) => {
    // 测量节点通过 Portal 挂到 body，不受缩略图外层 inert 约束。
    if (source) source.inert = true
  }, [])

  if (template.resource.status !== 'ready')
    return (
      <PreviewStatus
        error={template.resource.status === 'error'}
        onRetry={template.retry}
      />
    )

  const ready = documentState?.status === 'ready'

  return (
    <>
      <div
        inert
        aria-hidden
        className='pointer-events-none transition-opacity ease-(--ui-motion-enter-ease)'
        style={{
          opacity: ready ? 1 : 0,
          transitionDuration: reduceMotion ? '0s' : `${DURATION.base}s`,
        }}
      >
        <ScaledReadonlyPreview
          data={data}
          appearance={snapshot}
          definition={template.resource.data}
          assetUrls={template.assetUrls}
          sourceRef={setMeasurementSource}
          onDocumentStateChange={setDocumentState}
        />
      </div>
      {!ready && (
        <PreviewStatus
          error={documentState?.status === 'error'}
          onRetry={onRetry}
        />
      )}
    </>
  )
}

function PreviewStatus({
  error = false,
  onRetry,
}: {
  error?: boolean
  onRetry?: () => void
}) {
  const reduceMotion = useReducedMotion()

  return (
    <div
      className='absolute inset-0 flex flex-col items-center justify-center gap-2 px-2 text-center text-xs text-neutral-500'
      role='status'
    >
      {!error && (
        <Spinner
          aria-hidden
          className={reduceMotion ? 'animate-none' : undefined}
        />
      )}
      <span>{error ? '预览暂时不可用' : '正在加载预览…'}</span>
      {error && onRetry && (
        <Button
          variant='link'
          size='sm'
          className='text-neutral-700'
          onClick={onRetry}
        >
          重试
        </Button>
      )}
    </div>
  )
}
