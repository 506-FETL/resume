import { bindJobResume, useJobContextStore } from '@/lib/job-context'
import useResumeListStore from '@/pages/resume/store'
import useShareStore from '@/pages/share/store'
import {
  getTrackerAccountScope,
  isTrackerAccountScopeCurrent,
} from '@/pages/tracker/lib/account-scope'
import useUserStore from '@/store/user'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

export function useJobPreparation(loading: boolean) {
  const user = useUserStore((state) => state.currentUser)
  const openDeriveFor = useResumeListStore((state) => state.openDeriveFor)
  const jobContext = useJobContextStore((state) => state.context)
  const [routeParams] = useSearchParams()
  const routeJobId = routeParams.get('jobId')
  const routeAction = routeParams.get('action')

  const [preparingResume, setPreparingResume] = useState<{
    jobId: string
    userId: string | null
    resumeId: string
  } | null>(null)

  const prepareOperationRef = useRef(0)
  const prepareQueueRef = useRef<Promise<void>>(Promise.resolve())
  const handledJobActionRef = useRef<string | null>(null)

  useEffect(() => {
    if (
      !jobContext ||
      jobContext.id !== routeJobId ||
      !jobContext.resumeId ||
      loading
    )
      return

    const key = `${user?.id}:${jobContext.id}:${jobContext.resumeId}:${routeAction}`

    if (handledJobActionRef.current === key) return

    handledJobActionRef.current = key

    if (routeAction === 'customize') {
      if (!jobContext.jdText?.trim()) toast.info('请先返回岗位补充 JD 原文')
      else openDeriveFor(jobContext.resumeId)
    }
    if (routeAction === 'share')
      useShareStore
        .getState()
        .openDialog(jobContext.resumeId, jobContext.resumeName)
  }, [jobContext, routeJobId, routeAction, loading, openDeriveFor, user?.id])

  useLayoutEffect(() => {
    setPreparingResume(null)

    return () => {
      prepareOperationRef.current += 1
    }
  }, [routeJobId, user?.id])

  async function prepareForJob(resumeId: string) {
    if (!jobContext || jobContext.id !== routeJobId) return

    const jobId = jobContext.id
    const scope = getTrackerAccountScope()
    const operation = ++prepareOperationRef.current

    setPreparingResume({ jobId, userId: scope.userId, resumeId })

    const isCurrent = () =>
      operation === prepareOperationRef.current &&
      isTrackerAccountScopeCurrent(scope) &&
      useJobContextStore.getState().context?.id === jobId &&
      useJobContextStore.getState().context?.userId === scope.userId

    // 顺序写入，防止较早的绑定请求最后落库，覆盖用户的最新选择。
    prepareQueueRef.current = prepareQueueRef.current.then(async () => {
      if (!isCurrent()) return

      try {
        const context = await bindJobResume(jobId, resumeId)

        if (!isCurrent()) return

        useJobContextStore.getState().setContext(context)
        toast.success('已设为准备中的简历')
      } catch (error) {
        if (!isCurrent()) return

        toast.error(error instanceof Error ? error.message : '关联失败，请重试')
      } finally {
        if (isCurrent()) setPreparingResume(null)
      }
    })

    return prepareQueueRef.current
  }

  return { jobContext, routeJobId, preparingResume, prepareForJob }
}
