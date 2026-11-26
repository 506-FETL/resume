import type { ResumePreviewRequest } from '@/pages/resume/store/preview-types'
import { useEffect, useMemo, useRef, useState } from 'react'
import { inView } from 'motion/react'
import { PaperSkeleton } from '@/components/loading-skeleton'
import { PreviewContent } from '@/pages/resume/components/resume-card/resume-focus-preview'
import { useResumePreviewStore } from '@/pages/resume/store/preview-cache'
import { resumePreviewKey } from '@/pages/resume/store/preview-types'

export default function ResumeThumbnail({
  accountId,
  resumeId,
  updatedAt,
  templateBinding,
}: ResumePreviewRequest) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [entered, setEntered] = useState(false)

  const request = useMemo(
    () => ({ accountId, resumeId, updatedAt, templateBinding }),
    [accountId, resumeId, updatedAt, templateBinding],
  )

  const key = resumePreviewKey(request)
  const entry = useResumePreviewStore((state) => state.entries[key])
  const acquire = useResumePreviewStore((state) => state.acquire)
  const retry = useResumePreviewStore((state) => state.retry)

  useEffect(() => {
    let release: (() => void) | undefined

    const stop = inView(hostRef.current!, () => {
      release = acquire(request)
      setEntered(true)

      return () => {
        release?.()
        release = undefined
      }
    })

    return () => {
      stop()
      release?.()
    }
  }, [acquire, request, key])

  return (
    <div
      ref={hostRef}
      className='absolute inset-0 [&_button]:pointer-events-auto'
      data-resume-preview-state={entry?.status ?? 'idle'}
    >
      {entered ? (
        <PreviewContent key={key} entry={entry} onRetry={() => retry(key)} />
      ) : (
        <PaperSkeleton label='正在加载简历预览' compact className='h-full' />
      )}
    </div>
  )
}
