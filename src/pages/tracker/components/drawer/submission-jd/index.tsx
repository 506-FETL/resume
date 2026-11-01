import { useEffect } from 'react'
import AnimatedContent from '@/components/motion/animated-content'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import useTrackerStore from '../../../store'

type SubmissionJd = { jdText: string | null; jdUpdatedAt: string | null }

export function SubmissionJdContent({ jdText, jdUpdatedAt }: SubmissionJd) {
  return (
    <div className='space-y-2'>
      <p className='text-xs leading-relaxed text-muted-foreground'>
        {jdUpdatedAt
          ? `更新于 ${new Date(jdUpdatedAt).toLocaleString()}。`
          : '未记录 JD 更新时间。'}
      </p>
      <p className='whitespace-pre-wrap wrap-break-word text-sm'>
        {jdText || '没有保存 JD 原文'}
      </p>
    </div>
  )
}

export default function SubmissionJd({
  recordId,
  enabled,
  onRetry,
}: {
  recordId: string
  enabled: boolean
  onRetry: () => void
}) {
  const resource = useTrackerStore((state) => state.submissionJdsById[recordId])
  const revision = useTrackerStore((state) => state.submissionRevision)
  const current = resource?.revision === revision ? resource : null
  const data = current?.data
  const error = current?.error

  useEffect(() => {
    if (enabled) useTrackerStore.getState().loadSubmissionJd(recordId)
  }, [recordId, enabled, revision])

  return (
    <AnimatedContent
      animationKey={error ? 'error' : data ? 'ready' : 'loading'}
      className='px-1 pb-1'
    >
      {error ? (
        <Alert variant='destructive'>
          <AlertTitle>JD 副本加载失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <Button
            variant='outline'
            size='sm'
            className='mt-2 w-fit'
            onClick={() => {
              onRetry()
              useTrackerStore.getState().loadSubmissionJd(recordId)
            }}
          >
            重试
          </Button>
        </Alert>
      ) : data ? (
        <SubmissionJdContent {...data} />
      ) : (
        <p
          role='status'
          className='flex items-center gap-2 text-sm text-muted-foreground'
        >
          <Spinner aria-hidden className='motion-reduce:animate-none' />
          正在加载 JD 副本
        </p>
      )}
    </AnimatedContent>
  )
}
