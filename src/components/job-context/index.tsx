import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { PageLoading } from '@/components/page-loading'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  jobContextUrl,
  readJobContext,
  useJobContextStore,
} from '@/lib/job-context'
import useCurrentResumeStore from '@/store/resume/current'
import useUserStore from '@/store/user'

/** Load ownership before mounting editor/history/optimization consumers. */
export function JobContextGate({ children }: { children: ReactNode }) {
  const [params] = useSearchParams()
  const location = useLocation()
  const jobId = params.get('jobId')
  const userId = useUserStore((state) => state.currentUser?.id ?? null)

  const [state, setState] = useState<{
    key: string
    error: string | null
    ready: boolean
  }>({ key: '', error: null, ready: false })

  const [attempt, setAttempt] = useState(0)
  const key = `${userId}:${jobId}:${location.pathname}:${attempt}`

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false

    useJobContextStore.getState().setContext(null)

    if (!jobId) return

    setState({ key, error: null, ready: false })

    readJobContext(jobId, controller.signal)
      .then((context) => {
        if (cancelled) return

        useJobContextStore.getState().setContext(context)

        if (context.resumeId && context.resumeType)
          useCurrentResumeStore
            .getState()
            .setCurrentResume(context.resumeId, context.resumeType)

        setState({ key, error: null, ready: true })
      })
      .catch((error) => {
        if (!cancelled)
          setState({
            key,
            error: error instanceof Error ? error.message : '岗位加载失败',
            ready: false,
          })
      })

    return () => {
      cancelled = true
      controller.abort()
      useJobContextStore.getState().setContext(null)
    }
  }, [jobId, key])

  if (!jobId) return children
  if (state.key !== key || (!state.ready && !state.error))
    return <PageLoading />
  if (state.error)
    return (
      <div className='space-y-3 p-6'>
        <Alert variant='destructive'>
          <AlertTitle>岗位加载失败</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
        <div className='flex flex-wrap gap-2'>
          <Button onClick={() => setAttempt((value) => value + 1)}>重试</Button>
          <Button asChild variant='outline'>
            <Link to='/tracker'>返回求职跟进</Link>
          </Button>
        </div>
      </div>
    )

  const context = useJobContextStore.getState().context
  const requiresResume = location.pathname !== '/resume'

  if (requiresResume && !context?.resumeId)
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>还没有准备中的简历</EmptyTitle>
          <EmptyDescription>请先选择或创建一份简历。</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link to={jobContextUrl('/resume', jobId)}>选择或创建简历</Link>
          </Button>
          <Button asChild variant='outline'>
            <Link to={jobContextUrl('/tracker', jobId)}>返回岗位</Link>
          </Button>
        </EmptyContent>
      </Empty>
    )

  return children
}

export function JobContextBar() {
  const context = useJobContextStore((state) => state.context)
  const [params] = useSearchParams()

  if (!context || context.id !== params.get('jobId')) return null

  return (
    <div className='flex min-w-0 flex-wrap items-center gap-2 text-sm'>
      <Button asChild size='sm' variant='outline'>
        <Link to={jobContextUrl('/tracker', context.id)}>返回岗位</Link>
      </Button>
      <span className='min-w-0 truncate text-muted-foreground'>
        {context.company} · {context.position}
      </span>
    </div>
  )
}
