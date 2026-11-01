import {
  bindJobResume,
  jobContextUrl,
  useJobContextStore,
} from '@/lib/job-context'
import { toast } from 'sonner'
import { JobContextBar } from '@/components/job-context'
import type { MouseEvent } from 'react'
import type { ResumeItem } from './types'
import { ChevronLeft, ChevronRight, FileText, Plus } from 'lucide-react'
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
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import useCurrentUser from '@/hooks/use-current-user'
import {
  getTrackerAccountScope,
  isTrackerAccountScopeCurrent,
} from '@/pages/tracker/lib/account-scope'
import { DURATION, EASE, SPRING, staggerDelay } from '@/lib/motion'
import { getResumeSnapshotById } from '@/lib/supabase/resume/share'
import { RESUME_LIBRARY_PAGE_SIZE } from '@/lib/supabase/resume/library'
import useResumeListStore from '@/pages/resume/store'
import QuickDialog from '@/pages/share/components/quick-dialog'
import useShareStore from '@/pages/share/store'
import useCurrentResumeStore from '@/store/resume/current'
import CreateResumeCard from './components/create-resume-card'
import HeadBars from './components/head-bars'
import ResumeCard from './components/resume-card'
import SyncResumesDialog from './components/sync-resumes-dialog'

const EMPTY_RESUMES: ResumeItem[] = []
const LOADING_HINT_DELAY_MS = 200

export default function ResumePage() {
  const user = useCurrentUser()
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
  const [createOpen, setCreateOpen] = useState(false)
  const createTriggerRef = useRef<HTMLElement | null>(null)
  const allFilterTriggerRef = useRef<HTMLButtonElement | null>(null)
  const pageTriggerRef = useRef<HTMLButtonElement | null>(null)
  const pageStatusRef = useRef<HTMLSpanElement | null>(null)
  const resumeListRef = useRef<HTMLDivElement | null>(null)
  const [showLoadingHint, setShowLoadingHint] = useState(false)

  function openCreate(event: MouseEvent<HTMLButtonElement>) {
    createTriggerRef.current = event.currentTarget
    setCreateOpen(true)
  }

  const {
    libraryAccountId: accountId,
    libraryError: storeError,
    libraryItems: rawResumes,
    libraryLoading: storeLoading,
    libraryPage,
    libraryTotal,
    libraryCounts,
    libraryParents,
    loadLibraryPage,
    refreshLibrary,
    syncingIds,
    setupRealtimeSubscription,
    filterMode,
    setLibraryFilter,
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
    if (!loading) {
      setShowLoadingHint(false)

      return
    }

    const timer = window.setTimeout(
      () => setShowLoadingHint(true),
      LOADING_HINT_DELAY_MS,
    )

    return () => window.clearTimeout(timer)
  }, [loading])

  useEffect(() => {
    refreshLibrary()

    return () => useResumeListStore.getState().cancelLibraryLoad()
  }, [refreshLibrary, user?.id])

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

  const visibleItems = resumes

  const initialLoading =
    loading &&
    (!accountMatches || (libraryCounts === null && resumes.length === 0))

  const pageCount =
    libraryTotal === null
      ? null
      : Math.max(1, Math.ceil(libraryTotal / RESUME_LIBRARY_PAGE_SIZE))

  useLayoutEffect(() => {
    if (loading || !pageTriggerRef.current) return

    if (loadError) {
      const target = pageTriggerRef.current.disabled
        ? pageStatusRef.current
        : pageTriggerRef.current

      target?.focus({ preventScroll: true })
    } else {
      resumeListRef.current?.focus({ preventScroll: true })

      resumeListRef.current?.scrollIntoView({
        block: 'start',
        behavior: 'instant',
      })
    }

    pageTriggerRef.current = null
  }, [loading, libraryPage, loadError])

  function changePage(event: MouseEvent<HTMLButtonElement>, page: number) {
    pageTriggerRef.current = event.currentTarget
    loadLibraryPage(page)
  }

  const pendingResume = useMemo(
    () =>
      derivePendingFor
        ? (resumes.find((r) => r.resume_id === derivePendingFor) ??
          libraryParents[derivePendingFor] ??
          null)
        : null,
    [derivePendingFor, resumes, libraryParents],
  )

  return (
    <AnimatedContent
      key={user?.id ?? 'offline'}
      animationKey={initialLoading ? 'loading' : 'resumes'}
    >
      {initialLoading ? (
        <ResumePageSkeleton />
      ) : (
        <PageLayout>
          <JobContextBar />
          <HeadBars
            counts={accountMatches ? libraryCounts : null}
            isOnline={isOnline}
            offlineCount={accountMatches ? (libraryCounts?.offline ?? 0) : 0}
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
              <Button
                size='sm'
                variant='outline'
                onClick={() => refreshLibrary()}
              >
                重试
              </Button>
            </div>
          )}
          <div className='flex min-w-0 items-center gap-2'>
            <Tabs
              value={filterMode}
              onValueChange={(v) =>
                setLibraryFilter(v as 'all' | 'roots' | 'variants')
              }
              className='min-w-0'
            >
              <TabsList className='max-w-full'>
                <TabsTrigger ref={allFilterTriggerRef} value='all'>
                  全部
                </TabsTrigger>
                <TabsTrigger value='roots'>原始简历</TabsTrigger>
                <TabsTrigger value='variants'>岗位版本</TabsTrigger>
              </TabsList>
            </Tabs>
            <div
              role='status'
              aria-live='polite'
              className='w-16 shrink-0 text-xs whitespace-nowrap text-muted-foreground'
            >
              <AnimatePresence initial={false}>
                {loading && showLoadingHint && (
                  <PresenceDiv
                    key='library-loading'
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{
                      opacity: 0,
                      transition: {
                        duration: shouldReduceMotion ? 0 : DURATION.fast,
                        ease: EASE.in,
                      },
                    }}
                    transition={{
                      duration: shouldReduceMotion ? 0 : DURATION.base,
                      ease: EASE.out,
                    }}
                  >
                    正在加载…
                  </PresenceDiv>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div
            ref={resumeListRef}
            role='region'
            aria-label='简历列表'
            tabIndex={-1}
            className='min-w-0 scroll-mt-6 outline-none'
            aria-busy={loading}
            inert={loading || undefined}
          >
            <AnimatePresence mode='popLayout' initial={false}>
              {visibleItems.map((resume, index) => {
                const isSyncingThis = syncingIds.has(resume.resume_id)

                return (
                  <PresenceDiv
                    key={resume.resume_id}
                    className='min-w-0 border-b border-border/60 last:border-b-0'
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
                      onDeletedClose={() =>
                        pageStatusRef.current?.focus({ preventScroll: true })
                      }
                      preparedForJob={jobContext?.resumeId === resume.resume_id}
                      preparingForJob={
                        preparingResume?.jobId === routeJobId &&
                        preparingResume?.userId === user?.id &&
                        preparingResume?.resumeId === resume.resume_id
                      }
                      prepareDisabled={
                        preparingResume?.jobId === routeJobId &&
                        preparingResume?.userId === user?.id
                      }
                      onPrepareForJob={
                        jobContext?.id === routeJobId && !resume.isOffline
                          ? () => prepareForJob(resume.resume_id)
                          : undefined
                      }
                    />
                  </PresenceDiv>
                )
              })}

              {visibleItems.length === 0 && !loadError && !loading && (
                <PresenceDiv
                  key='create-empty'
                  layout={shouldReduceMotion ? false : 'position'}
                  initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 8 }}
                  animate={{ opacity: 1, y: 0 }}
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
                  <Empty className='min-h-64 px-4 py-10'>
                    <EmptyHeader>
                      <EmptyMedia variant='icon'>
                        <FileText aria-hidden />
                      </EmptyMedia>
                      <EmptyTitle>
                        {libraryCounts?.all === 0
                          ? '还没有简历'
                          : filterMode === 'variants'
                            ? '还没有可用的岗位版本'
                            : '没有原始简历'}
                      </EmptyTitle>
                      <EmptyDescription>
                        {libraryCounts?.all === 0
                          ? '创建一份简历，整理经历并选择适合的模板。'
                          : filterMode === 'variants'
                            ? '从原始简历创建岗位版本，生成完成后会显示在这里。'
                            : '创建一份新的原始简历，已有岗位版本可在「全部」中查看。'}
                      </EmptyDescription>
                    </EmptyHeader>
                    <div className='flex flex-wrap justify-center gap-2'>
                      {(libraryCounts?.all ?? 0) > 0 && (
                        <Button
                          variant='outline'
                          onClick={() => {
                            allFilterTriggerRef.current?.focus({
                              preventScroll: true,
                            })

                            setLibraryFilter('all')
                          }}
                        >
                          查看全部简历
                        </Button>
                      )}
                      <Button
                        aria-label='打开创建简历表单'
                        onClick={openCreate}
                      >
                        <Plus aria-hidden />
                        创建新简历
                      </Button>
                    </div>
                  </Empty>
                </PresenceDiv>
              )}
            </AnimatePresence>
          </div>

          <nav
            aria-label='简历分页'
            className='flex min-w-0 items-center justify-end gap-2'
          >
            <span
              ref={pageStatusRef}
              tabIndex={-1}
              role='status'
              aria-live='polite'
              className='mr-1 text-xs whitespace-nowrap text-muted-foreground tabular-nums'
            >
              {pageCount !== null
                ? `第 ${libraryPage} / ${pageCount} 页 · 每页 ${RESUME_LIBRARY_PAGE_SIZE} 份`
                : loading
                  ? `每页 ${RESUME_LIBRARY_PAGE_SIZE} 份`
                  : '页数暂不可用'}
            </span>
            <Button
              variant='outline'
              size='icon-sm'
              aria-label='上一页简历'
              disabled={loading || libraryPage <= 1}
              onClick={(event) => changePage(event, libraryPage - 1)}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant='outline'
              size='icon-sm'
              aria-label='下一页简历'
              disabled={
                loading || pageCount === null || libraryPage >= pageCount
              }
              onClick={(event) => changePage(event, libraryPage + 1)}
            >
              <ChevronRight />
            </Button>
          </nav>

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

      <Skeleton className='h-9 w-60 max-w-full' />
      <div className='divide-y divide-border/60'>
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className='grid min-w-0 grid-cols-[88px_minmax(0,1fr)] items-center gap-x-5 gap-y-4 px-2 py-5 sm:grid-cols-[132px_minmax(0,1fr)] sm:gap-x-8 sm:px-4 sm:py-6'
          >
            <Skeleton className='aspect-[210/297] w-full self-start rounded-sm sm:row-span-2 sm:self-center' />
            <div className='min-w-0 space-y-3'>
              <Skeleton className='h-8 w-72 max-w-full' />
              <div className='flex flex-wrap gap-2'>
                <Skeleton className='h-5 w-20' />
                <Skeleton className='h-5 w-24' />
              </div>
              <Skeleton className='h-4 w-80 max-w-full' />
            </div>
            <div className='col-span-2 flex flex-wrap gap-2 sm:col-span-1 sm:col-start-2'>
              <Skeleton className='h-9 w-24' />
              <Skeleton className='h-9 w-40' />
            </div>
          </div>
        ))}
      </div>
    </PageLayout>
  )
}
