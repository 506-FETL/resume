import { useSearchParams } from 'react-router-dom'
import { memo, useEffect, useMemo, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { PageLayout } from '@/components/layout/page-layout'
import { AnimatedContent } from '@/components/motion/animated-content'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useDelayedBusy } from '@/hooks/use-delayed-busy'
import { useIsMobile } from '@/hooks/use-mobile'
import BoardView from './components/board'
import JobDrawer from './components/drawer'
import AddJobDrawer from './components/drawer/add-job'
import SubmissionDialog from './components/drawer/submission-dialog'
import ReopenProcessDialog from './components/drawer/reopen-process'
import TrackerHeader from './components/header'
import ListView from './components/list'
import { TrackerPageState, TrackerSkeleton } from './components/page-state'
import TrackerToolbar from './components/toolbar'
import ViewTransition from './components/view-transition'
import { useTrackerJobs } from './hooks/use-tracker-jobs'
import useTrackerStore from './store'
import { selectTrackerListJobs } from './store/selectors'
import { filterJobs } from './utils'

function TrackerContent() {
  const {
    jobs,
    viewMode: preferredViewMode,
    loading,
    error,
    isInitialized,
    showArchived,
    filterStatus,
    metricFilter,
    searchKeyword,
    filterCompanyId,
    focusedOnly,
  } = useTrackerStore(
    useShallow((state) => ({
      jobs: selectTrackerListJobs(state),
      viewMode: state.viewMode,
      loading: state.loading,
      error: state.error,
      isInitialized: state.isInitialized,
      showArchived: state.showArchived,
      filterStatus: state.filterStatus,
      metricFilter: state.metricFilter,
      searchKeyword: state.searchKeyword,
      filterCompanyId: state.filterCompanyId,
      focusedOnly: state.focusedOnly,
    })),
  )

  const [routeParams] = useSearchParams()
  const isMobile = useIsMobile()
  const viewMode = isMobile ? 'list' : preferredViewMode
  const routeJobId = routeParams.get('jobId')
  const routeTab = routeParams.get('tab')
  const routeFocus = routeParams.get('focus')

  useEffect(() => {
    if (routeFocus !== '1') return

    const store = useTrackerStore.getState()

    store.clearFilters()
    store.setSearchKeyword('')
    store.setShowArchived(false)
    store.setFocusedOnly(true)
  }, [routeFocus])

  const openedRouteRef = useRef<string | null>(null)

  useEffect(() => {
    if (!routeJobId || !isInitialized || loading) return

    const job = useTrackerStore
      .getState()
      .jobs.find((row) => row.id === routeJobId)

    const scope = useTrackerStore.getState().accountScope
    const key = `${scope.generation}:${routeJobId}:${routeTab}`

    if (!job || job.user_id !== scope.userId || openedRouteRef.current === key)
      return

    openedRouteRef.current = key
    useTrackerStore.getState().openJobDrawer(job)
  }, [routeJobId, routeTab, isInitialized, loading, jobs])

  const { reload } = useTrackerJobs()
  const busy = !isInitialized && (loading || !error)
  const showRefreshing = useDelayedBusy(isInitialized && loading)

  const visibleJobs = useMemo(
    () =>
      filterJobs(
        filterCompanyId
          ? jobs.filter((job) => job.tracker_company_id === filterCompanyId)
          : jobs,
        filterStatus,
        searchKeyword,
        showArchived,
        metricFilter,
        focusedOnly,
      ),
    [
      jobs,
      filterStatus,
      metricFilter,
      searchKeyword,
      showArchived,
      filterCompanyId,
      focusedOnly,
    ],
  )

  const scopedJobs = useMemo(
    () => filterJobs(jobs, null, '', showArchived),
    [jobs, showArchived],
  )

  useEffect(() => {
    const { selectedIds } = useTrackerStore.getState()

    if (selectedIds.size === 0) return

    const visibleIds = new Set(visibleJobs.map((job) => job.id))

    const nextSelectedIds = new Set(
      [...selectedIds].filter((id) => visibleIds.has(id)),
    )

    if (nextSelectedIds.size !== selectedIds.size)
      useTrackerStore.setState({ selectedIds: nextSelectedIds })
  }, [visibleJobs])

  const state = busy
    ? 'loading'
    : error && !isInitialized
      ? 'error'
      : scopedJobs.length === 0
        ? showArchived
          ? 'archived'
          : 'empty'
        : visibleJobs.length === 0
          ? 'filtered'
          : viewMode

  return (
    <>
      <PageLayout
        workspace
        className='min-h-0 gap-4 md:gap-2 [@media(max-height:500px)]:gap-2 [@media(max-height:500px)]:py-2'
      >
        <TrackerHeader />
        <main
          aria-label='职位工作区'
          className='@container/tracker flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background md:border-t'
        >
          <TrackerToolbar />
          {isInitialized && (
            <div className='flex min-h-7 shrink-0 items-center text-xs text-muted-foreground'>
              <span role='status' className='sr-only'>
                {loading ? '正在刷新职位' : error ? `刷新失败：${error}` : ''}
              </span>
              <AnimatedContent
                animationKey={
                  error ? 'error' : showRefreshing ? 'refreshing' : 'idle'
                }
              >
                {error ? (
                  <div className='flex min-w-0 flex-wrap items-center gap-2'>
                    <span className='break-words'>
                      刷新失败，仍显示上次结果：{error}
                    </span>
                    <Button
                      variant='ghost'
                      size='sm'
                      className='h-7 px-2 text-xs'
                      onClick={reload}
                      disabled={loading}
                    >
                      重试
                    </Button>
                  </div>
                ) : showRefreshing ? (
                  <span
                    className='inline-flex items-center gap-1.5'
                    aria-hidden
                  >
                    <Spinner className='size-3' aria-hidden />
                    正在刷新职位
                  </span>
                ) : null}
              </AnimatedContent>
            </div>
          )}
          <ViewTransition
            id={isMobile ? 'tracker-mobile-results' : undefined}
            role={isMobile ? 'tabpanel' : undefined}
            aria-labelledby={
              isMobile
                ? `tracker-filter-${filterStatus ?? metricFilter ?? 'all'}`
                : undefined
            }
            animationKey={state}
            className='flex min-h-0 min-w-0 flex-1 flex-col pt-1 md:pt-3'
          >
            {state === 'loading' ? (
              <TrackerSkeleton />
            ) : state === 'board' ? (
              <BoardView />
            ) : state === 'list' ? (
              <div className='flex min-h-0 flex-1 flex-col overflow-y-auto'>
                <ListView />
              </div>
            ) : (
              <TrackerPageState mode={state} onRetry={reload} />
            )}
          </ViewTransition>
        </main>
      </PageLayout>
      <JobDrawer />
      <AddJobDrawer />
      <SubmissionDialog />
      <ReopenProcessDialog />
    </>
  )
}

function Tracker() {
  const scope = useTrackerStore((state) => state.accountScope)

  // 账号切换时丢弃局部表单、确认框和退出动画中的旧内容。
  return <TrackerContent key={scope.generation} />
}

export default memo(Tracker)
