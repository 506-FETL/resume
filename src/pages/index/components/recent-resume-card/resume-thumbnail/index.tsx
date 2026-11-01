import type { ResumePreviewRequest } from '@/pages/resume/store/preview-types'
import { useEffect, useMemo } from 'react'
import { PreviewContent } from '@/pages/resume/components/resume-card/resume-focus-preview'
import { useResumePreviewStore } from '@/pages/resume/store/preview-cache'
import { resumePreviewKey } from '@/pages/resume/store/preview-types'

export default function ResumeThumbnail({
  accountId,
  resumeId,
  updatedAt,
  templateBinding,
}: ResumePreviewRequest) {
  const request = useMemo(
    () => ({ accountId, resumeId, updatedAt, templateBinding }),
    [accountId, resumeId, updatedAt, templateBinding],
  )

  const key = resumePreviewKey(request)
  const entry = useResumePreviewStore((state) => state.entries[key])
  const acquire = useResumePreviewStore((state) => state.acquire)
  const retry = useResumePreviewStore((state) => state.retry)

  useEffect(() => acquire(request), [acquire, request, key])

  return (
    <div
      className='absolute inset-0 [&_button]:pointer-events-auto'
      data-resume-preview-state={entry?.status ?? 'idle'}
    >
      <PreviewContent key={key} entry={entry} onRetry={() => retry(key)} />
    </div>
  )
}
