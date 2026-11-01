import { useEffect, useState } from 'react'
import AnimatedContent from '@/components/motion/animated-content'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { getJobSubmissionJd } from '@/lib/supabase/resume/submissions'
import {
  createTrackerAccountGuard,
  getTrackerAccountScope,
  isTrackerAccountScopeCurrent,
} from '../../../lib/account-scope'
import { getTrackerErrorMessage } from '../../../utils'

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
  const [data, setData] = useState<SubmissionJd | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!enabled || data) return

    const scope = getTrackerAccountScope()
    let active = true

    setError(null)

    getJobSubmissionJd(recordId, createTrackerAccountGuard(scope))
      .then((result) => {
        if (active && isTrackerAccountScopeCurrent(scope)) setData(result)
      })
      .catch((cause) => {
        if (active && isTrackerAccountScopeCurrent(scope))
          setError(getTrackerErrorMessage(cause))
      })

    return () => {
      active = false
    }
  }, [recordId, enabled, attempt, data])

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
              setAttempt((value) => value + 1)
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
