import {
  bindJobResume,
  jobContextUrl,
  useJobContextStore,
} from '@/lib/job-context'
import { toast } from 'sonner'
import { JobContextBar } from '@/components/job-context'
import type { MouseEvent } from 'react'
import type { ResumeItem } from './types'
import { Plus } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { JdVariantDialog } from '@/components/jd-variant/components/generator-dialog'
import { DerivedJobsDialog } from '@/components/jd-variant/components/tasks-dialog'
import { PageLayout } from '@/components/layout/page-layout'
import AnimatedContent from '@/components/motion/animated-content'
import { PresenceDiv } from '@/components/motion/presence-item'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import useCurrentUser from '@/hooks/use-current-user'
import {
  getTrackerAccountScope,
  isTrackerAccountScopeCurrent,
} from '@/pages/tracker/lib/account-scope'
import { DURATION, EASE, SPRING, staggerDelay } from '@/lib/motion'
import { getResumeSnapshotById } from '@/lib/supabase/resume/share'
import useResumeListStore from '@/pages/resume/store'
import QuickDialog from '@/pages/share/components/quick-dialog'
import useShareStore from '@/pages/share/store'
import useCurrentResumeStore from '@/store/resume/current'
import CreateResumeCard from './components/create-resume-card'
import HeadBars from './components/head-bars'
import ResumeCard from './components/resume-card'
import SyncResumesDialog from './components/sync-resumes-dialog'

const EMPTY_RESUMES: ResumeItem[] = []

export default function ResumePage() {
  const user = useCurrentUser()
  const jobContext = useJobContextStore((state) => state.context)
  const [routeParams] = useSearchParams()
  const routeJobId = routeParams.get('jobId')
  const routeAction = routeParams.get('action')
  const prepareOperationRef = useRef(0)
  const prepareQueueRef = useRef<Promise<void>>(Promise.resolve())
  const handledJobActionRef = useRef<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const createTriggerRef = useRef<HTMLElement | null>(null)

  function openCreate(event: MouseEvent<HTMLButtonElement>) {
    createTriggerRef.current = event.currentTarget
    setCreateOpen(true)
  }

  const {
    accountId,
    loadError: storeError,
    resumes: rawResumes,
    loading: storeLoading,
    offlineResumes,
    syncingIds,
    loadResumes,
    setupRealtimeSubscription,
    filterMode,
    setFilterMode,
    derivePendingFor,
    openDeriveFor,
    derivedJobsOpen,
    setDerivedJobsOpen,
  } = useResumeListStore()

  const accountMatches = accountId === (user?.id ?? null)
  const resumes = accountMatches ? rawResumes : EMPTY_RESUMES
  const loading = !accountMatches || storeLoading
  const loadError = accountMatches ? storeError : null
  const isOnline = Boolean(user)
  const { setCurrentResume } = useCurrentResumeStore()
  const { openForResumeId: shareOpenForResumeId } = useShareStore()
  const navigate = useNavigate()
  const shouldReduceMotion = useReducedMotion()
  const retainedDeriveParentId = useRef<string | null>(derivePendingFor)

  if (derivePendingFor) {
    retainedDeriveParentId.current = derivePendingFor
  }

  const deriveDialogParentId =
    derivePendingFor ?? retainedDeriveParentId.current

  useEffect(() => {
    loadResumes()

    return () => useResumeListStore.getState().cancelLoad()
  }, [loadResumes, user?.id])

  useEffect(() => {
    if (!isOnline) return

    return setupRealtimeSubscription()
  }, [isOnline, setupRealtimeSubscription, user?.id])

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
      if (!jobContext.jdText.trim()) toast.info('请先返回岗位补充 JD 原文')
      else openDeriveFor(jobContext.resumeId)
    }
    if (routeAction === 'share')
      useShareStore
        .getState()
        .openDialog(jobContext.resumeId, jobContext.resumeName)
  }, [jobContext, routeJobId, routeAction, loading, openDeriveFor, user?.id])

  useLayoutEffect(() => {
    return () => {
      prepareOperationRef.current += 1
    }
  }, [routeJobId, user?.id])

  async function prepareForJob(resumeId: string) {
    if (!jobContext || jobContext.id !== routeJobId) return

    const jobId = jobContext.id
    const scope = getTrackerAccountScope()
    const operation = ++prepareOperationRef.current

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
      }
    })

    return prepareQueueRef.current
  }

  const visibleItems = useMemo(() => {
    if (filterMode === 'roots')
      return resumes.filter((r) => !r.parent_resume_id)
    if (filterMode === 'variants')
      return resumes.filter(
        (r) => r.parent_resume_id && r.derived_status === 'ready',
      )

    return resumes
  }, [resumes, filterMode])

  const pendingResume = useMemo(
    () =>
      derivePendingFor
        ? (resumes.find((r) => r.resume_id === derivePendingFor) ?? null)
        : null,
    [derivePendingFor, resumes],
  )

  return (
    <AnimatedContent
      key={user?.id ?? 'offline'}
      animationKey={loading ? 'loading' : 'resumes'}
    >
      {loading ? (
        <ResumePageSkeleton />
      ) : (
        <PageLayout>
          <JobContextBar />
          <HeadBars
            resumes={resumes}
            isOnline={isOnline}
            offlineCount={accountMatches ? offlineResumes.length : 0}
            onCreate={openCreate}
          />
          {loadError && (
            <div
              role='status'
              className='flex items-center justify-between gap-3 rounded-lg border p-3 text-sm'
            >
              <span>
                {resumes.length ? '刷新失败，保留上次数据' : '简历加载失败'}
              </span>
              <Button size='sm' variant='outline' onClick={loadResumes}>
                重试
              </Button>
            </div>
          )}
          <Tabs
            value={filterMode}
            onValueChange={(v) =>
              setFilterMode(v as 'all' | 'roots' | 'variants')
            }
            className='min-w-0'
          >
            <TabsList className='max-w-full'>
              <TabsTrigger value='all'>全部</TabsTrigger>
              <TabsTrigger value='roots'>原始简历</TabsTrigger>
              <TabsTrigger value='variants'>岗位版本</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className='grid grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-4'>
            <AnimatePresence mode='popLayout' initial={false}>
              {visibleItems.map((resume, index) => {
                const isSyncingThis = syncingIds.has(resume.resume_id)

                return (
                  <PresenceDiv
                    key={resume.resume_id}
                    className='min-w-0'
                    layout={shouldReduceMotion ? false : 'position'}
                    initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 8 }}
                    animate={{
                      opacity: isSyncingThis ? 0.55 : 1,
                      y: 0,
                      transition: {
                        duration: shouldReduceMotion ? 0 : DURATION.base,
                        ease: EASE.out,
                        delay: shouldReduceMotion
                          ? 0
                          : staggerDelay(Math.min(index, 8)),
                      },
                    }}
                    exit={{
                      opacity: 0,
                      y: shouldReduceMotion ? 0 : -4,
                      transition: {
                        duration: shouldReduceMotion ? 0 : DURATION.fast,
                        ease: EASE.in,
                      },
                    }}
                    transition={{
                      duration: shouldReduceMotion ? 0 : DURATION.base,
                      ease: EASE.out,
                      layout: shouldReduceMotion
                        ? { duration: 0 }
                        : SPRING.layout,
                    }}
                  >
                    <ResumeCard
                      resume={resume}
                      onPrepareForJob={
                        jobContext?.id === routeJobId && !resume.isOffline
                          ? () => prepareForJob(resume.resume_id)
                          : undefined
                      }
                    />
                  </PresenceDiv>
                )
              })}

              <PresenceDiv
                key='create-card'
                layout={shouldReduceMotion ? false : 'position'}
                initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: shouldReduceMotion ? 0 : DURATION.base,
                  ease: EASE.out,
                  layout: shouldReduceMotion ? { duration: 0 } : SPRING.layout,
                }}
              >
                <button
                  type='button'
                  aria-label='打开创建简历表单'
                  onClick={openCreate}
                  className='flex h-full min-h-48 w-full cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-xl border border-dashed bg-card py-5 text-card-foreground shadow-xs ring-1 ring-foreground/10 transition-[border-color,box-shadow,background-color] ease-(--ui-motion-enter-ease) hover:border-primary/50 hover:bg-muted/20 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
                  style={{
                    transitionDuration: shouldReduceMotion
                      ? '0s'
                      : `${DURATION.base}s`,
                  }}
                >
                  <span aria-hidden='true' className='flex justify-center px-6'>
                    <span className='flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10'>
                      <Plus className='size-5' />
                    </span>
                  </span>
                  <span className='flex justify-center px-6 text-sm font-medium'>
                    创建新简历
                  </span>
                </button>
              </PresenceDiv>
            </AnimatePresence>
          </div>

          <CreateResumeCard
            online={isOnline}
            returnFocusRef={createTriggerRef}
            hideTrigger
            open={createOpen}
            onOpenChange={setCreateOpen}
          />
          <SyncResumesDialog />

          <QuickDialog
            getSnapshot={async () => {
              if (!shareOpenForResumeId) throw new Error('未选择简历')

              return getResumeSnapshotById(shareOpenForResumeId)
            }}
          />

          <DerivedJobsDialog
            open={derivedJobsOpen}
            onOpenChange={setDerivedJobsOpen}
          />

          {deriveDialogParentId && (
            <JdVariantDialog
              key={deriveDialogParentId}
              open={Boolean(derivePendingFor)}
              onOpenChange={(o) => {
                if (!o) openDeriveFor(null)
              }}
              parentResumeId={deriveDialogParentId}
              recentJds={[]}
              initialJd={
                jobContext?.id === routeJobId
                  ? jobContext.jdText
                  : (pendingResume?.linked_jd_text ?? '')
              }
              jobId={jobContext?.id === routeJobId ? jobContext.id : undefined}
              onOpenResume={(draftId) => {
                const target = resumes.find((r) => r.resume_id === draftId)

                setCurrentResume(draftId, target?.type ?? 'default')

                navigate(
                  jobContext?.id === routeJobId
                    ? jobContextUrl('/resume/editor', jobContext.id)
                    : '/resume/editor',
                )
              }}
            />
          )}
        </PageLayout>
      )}
    </AnimatedContent>
  )
}

function ResumePageSkeleton() {
  return (
    <PageLayout>
      <div className='flex flex-col gap-2'>
        <Skeleton className='h-9 w-48' />
        <Skeleton className='h-5 w-64' />
      </div>

      <div className='grid grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-4'>
        {Array.from({ length: 8 }, (_, idx) => idx).map((i) => (
          <Card key={i} className='min-h-48 gap-3 p-4'>
            <div className='flex items-center gap-2.5'>
              <Skeleton className='size-8 rounded-lg' />
              <div className='space-y-1.5'>
                <Skeleton className='h-3 w-16' />
                <Skeleton className='h-3 w-24' />
              </div>
            </div>
            <div className='flex-1 space-y-2'>
              <Skeleton className='h-5 w-3/4' />
              <Skeleton className='h-4 w-1/2' />
            </div>
            <div className='flex gap-2 border-t pt-3'>
              <Skeleton className='h-8 flex-1' />
              <Skeleton className='h-8 w-14' />
              <Skeleton className='h-8 w-14' />
            </div>
          </Card>
        ))}
      </div>
    </PageLayout>
  )
}
