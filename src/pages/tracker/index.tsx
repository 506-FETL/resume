import { useSearchParams } from 'react-router-dom'
import { memo, useEffect, useMemo, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { PageLayout } from '@/components/layout/page-layout'
import BoardView from './components/board'
import JobDrawer from './components/drawer'
import AddJobDrawer from './components/drawer/add-job'
import SubmissionDialog from './components/drawer/submission-dialog'
import ReopenProcessDialog from './components/drawer/reopen-process'
import TrackerHeader from './components/header'
import ListView from './components/list'
import OverviewBar from './components/overview-bar'
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
    viewMode,
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
  const busy = loading || (!isInitialized && !error)

  const visibleJobs = useMemo(
    () =>
      filterJobs(
        filterCompanyId
          ? jobs.filter((job) => job.tracker_company_id === filterCompanyId)
          : jobs,
        viewMode === 'list' ? filterStatus : null,
        searchKeyword,
        showArchived,
        viewMode === 'list' ? metricFilter : null,
        focusedOnly,
      ),
    [
      jobs,
      viewMode,
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

  const state = busy
    ? 'loading'
    : error
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
      <PageLayout workspace className='gap-2'>
        <TrackerHeader />
        <main
          aria-label='职位工作区'
          className='@container/tracker flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card'
        >
          <OverviewBar />
          <TrackerToolbar />
          <ViewTransition
            animationKey={state}
            className='flex min-h-0 min-w-0 flex-1 flex-col p-2'
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
