import { JdVariantDialog } from '@/components/jd-variant/components/generator-dialog'
import { DerivedJobsDialog } from '@/components/jd-variant/components/tasks-dialog'
import { JobContextBar } from '@/components/job-context'
import { PageLayout } from '@/components/layout/page-layout'
import AnimatedContent from '@/components/motion/animated-content'
import { PresenceDiv } from '@/components/motion/presence-item'
import { ResumeLibrarySkeleton } from '@/components/resume/library-skeleton'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { jobContextUrl } from '@/lib/job-context'
import { DURATION, EASE } from '@/lib/motion'
import { RESUME_LIBRARY_PAGE_SIZE } from '@/lib/supabase/resume/library'
import { getResumeSnapshotById } from '@/lib/supabase/resume/share'
import useResumeListStore from '@/pages/resume/store'
import QuickDialog from '@/pages/share/components/quick-dialog'
import useShareStore from '@/pages/share/store'
import useCurrentResumeStore from '@/store/resume/current'
import useUserStore from '@/store/user'
import { AnimatePresence } from 'motion/react'
import type { MouseEvent } from 'react'
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useNavigate } from 'react-router-dom'
import CreateResumeCard from './components/create-resume-card'
import HeadBars from './components/head-bars'
import { LibraryFilters } from './components/library-filters'
import { LibraryPagination } from './components/library-pagination'
import { LibraryResults } from './components/library-results'
import LibrarySearch from './components/library-search'
import SyncResumesDialog from './components/sync-resumes-dialog'
import { useDeriveJd } from './hooks/use-derive-jd'
import { useJobPreparation } from './hooks/use-job-preparation'
import type { ResumeItem } from './types'

const EMPTY_RESUMES: ResumeItem[] = []
const LOADING_HINT_DELAY_MS = 200

export default function ResumePage() {
  const libraryResultsId = useId()
  const user = useUserStore((state) => state.currentUser)
  const authStatus = useUserStore((state) => state.authStatus)
  const [createOpen, setCreateOpen] = useState(false)
  const createTriggerRef = useRef<HTMLButtonElement | null>(null)
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
    libraryCountsError,
    libraryHasLoaded,
    libraryQuery,
    libraryParents,
    loadLibraryPage,
    refreshLibrary,
    setupRealtimeSubscription,
    filterMode,
    derivePendingFor,
    openDeriveFor,
    derivedJobsOpen,
    setDerivedJobsOpen,
  } = useResumeListStore()

  const accountMatches =
    authStatus !== 'unknown' && accountId === (user?.id ?? null)

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
    if (authStatus === 'unknown') return

    refreshLibrary()

    return () => useResumeListStore.getState().cancelLibraryLoad()
  }, [refreshLibrary, user?.id, authStatus])

  useEffect(() => {
    if (!isOnline) return

    return setupRealtimeSubscription()
  }, [isOnline, setupRealtimeSubscription, user?.id])

  const jobPreparation = useJobPreparation(loading)
  const { jobContext, routeJobId } = jobPreparation

  const initialLoading = loading && (!accountMatches || !libraryHasLoaded)

  const pageCount =
    libraryTotal === null
      ? null
      : Math.max(1, Math.ceil(libraryTotal / RESUME_LIBRARY_PAGE_SIZE))

  useLayoutEffect(() => {
    pageTriggerRef.current = null
    resumeListRef.current?.scrollTo({ top: 0, behavior: 'instant' })
  }, [libraryQuery, filterMode])

  useLayoutEffect(() => {
    if (loading || !pageTriggerRef.current) return

    if (loadError) {
      const target = pageTriggerRef.current.disabled
        ? pageStatusRef.current
        : pageTriggerRef.current

      target?.focus({ preventScroll: true })
    } else {
      resumeListRef.current?.focus({ preventScroll: true })

      resumeListRef.current?.scrollTo({
        top: 0,
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

  const useJobJd = jobContext?.id === routeJobId

  const deriveJd = useDeriveJd(
    !useJobJd &&
      (pendingResume?.linked_jd_excerpt ||
        pendingResume?.linked_jd_text ||
        pendingResume?.derived_status)
      ? derivePendingFor
      : null,
  )

  return (
    <>
      <AnimatedContent
        key={user?.id ?? 'offline'}
        animationKey={initialLoading ? 'loading' : 'resumes'}
        className='h-full min-h-0'
      >
        {initialLoading ? (
          <ResumeLibrarySkeleton
            header={
              accountMatches && (libraryCounts || libraryCountsError) ? (
                <HeadBars
                  counts={libraryCounts}
                  isOnline={isOnline}
                  offlineCount={libraryCounts?.offline ?? 0}
                  onCreate={openCreate}
                  createButtonRef={createTriggerRef}
                />
              ) : undefined
            }
          />
        ) : (
          <PageLayout className='h-full min-h-0 gap-4 overflow-hidden py-4 sm:gap-6 sm:py-6 [@media(max-height:500px)]:gap-1 [@media(max-height:500px)]:py-1'>
            <div className='shrink-0 space-y-4 sm:space-y-6 [@media(max-height:500px)]:space-y-1'>
              <div className='space-y-4 sm:space-y-6 [@media(max-height:500px)]:max-h-[calc(100dvh-16rem)] [@media(max-height:500px)]:space-y-1 [@media(max-height:500px)]:overflow-y-auto [@media(max-height:500px)]:overscroll-contain'>
                <div className='empty:hidden [@media(max-height:500px)]:[&>div]:flex-nowrap [@media(max-height:500px)]:[&_a]:h-9'>
                  <JobContextBar />
                </div>
                <HeadBars
                  counts={accountMatches ? libraryCounts : null}
                  isOnline={isOnline}
                  offlineCount={
                    accountMatches ? (libraryCounts?.offline ?? 0) : 0
                  }
                  onCreate={openCreate}
                  createButtonRef={createTriggerRef}
                />
                {loadError && (
                  <div
                    role='status'
                    className='flex items-center justify-between gap-3 rounded-lg border p-3 text-sm [@media(max-height:500px)]:p-2'
                  >
                    <span>
                      {resumes.length
                        ? '刷新失败，保留上次数据'
                        : '简历加载失败'}
                    </span>
                    <Button
                      size='sm'
                      variant='outline'
                      className='[@media(max-height:500px)]:h-9'
                      onClick={() =>
                        libraryQuery
                          ? loadLibraryPage(libraryPage)
                          : refreshLibrary()
                      }
                    >
                      重试
                    </Button>
                  </div>
                )}
              </div>
              <div className='flex min-w-0 flex-col gap-2 sm:flex-row sm:justify-between [@media(max-height:500px)]:gap-1'>
                <LibrarySearch />
                <div className='flex min-w-0 items-center gap-2'>
                  <LibraryFilters
                    resultsId={libraryResultsId}
                    allTriggerRef={allFilterTriggerRef}
                  />
                  <div className='flex h-4 w-16 shrink-0 items-center text-muted-foreground'>
                    <AnimatePresence initial={false}>
                      {loading && showLoadingHint && (
                        <PresenceDiv
                          key='library-loading'
                          className='flex'
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
                          <Spinner
                            className='size-4'
                            aria-label='正在加载简历'
                          />
                        </PresenceDiv>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </div>

            <LibraryResults
              id={libraryResultsId}
              resumes={resumes}
              loading={loading}
              loadError={loadError}
              resumeListRef={resumeListRef}
              pageStatusRef={pageStatusRef}
              allFilterTriggerRef={allFilterTriggerRef}
              openCreate={openCreate}
              jobPreparation={jobPreparation}
            />
            <LibraryPagination
              loading={loading}
              pageCount={pageCount}
              pageStatusRef={pageStatusRef}
              changePage={changePage}
            />

            <QuickDialog
              getSnapshot={async () => {
                if (!shareOpenForResumeId) throw new Error('未选择简历')

                return getResumeSnapshotById(shareOpenForResumeId)
              }}
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
                    : deriveJd.text
                }
                initialJdLoading={!useJobJd && deriveJd.loading}
                initialJdError={!useJobJd ? deriveJd.error : null}
                onRetryInitialJd={deriveJd.retry}
                jobId={
                  jobContext?.id === routeJobId ? jobContext.id : undefined
                }
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
      <CreateResumeCard
        online={isOnline}
        returnFocusRef={createTriggerRef}
        hideTrigger
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
      <SyncResumesDialog />
      <DerivedJobsDialog
        open={derivedJobsOpen}
        onOpenChange={setDerivedJobsOpen}
      />
    </>
  )
}
