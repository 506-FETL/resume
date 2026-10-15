import { memo, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import BoardView from './components/board'
import JobDrawer from './components/drawer'
import AddJobDrawer from './components/drawer/add-job'
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
  const { jobs, viewMode, loading, error, isInitialized, showArchived, filterStatus, metricFilter, searchKeyword } = useTrackerStore(useShallow(state => ({
    jobs: selectTrackerListJobs(state),
    viewMode: state.viewMode,
    loading: state.loading,
    error: state.error,
    isInitialized: state.isInitialized,
    showArchived: state.showArchived,
    filterStatus: state.filterStatus,
    metricFilter: state.metricFilter,
    searchKeyword: state.searchKeyword,
  })))
  const { reload } = useTrackerJobs()
  const busy = loading || (!isInitialized && !error)
  const visibleJobs = useMemo(() => filterJobs(jobs, viewMode === 'list' ? filterStatus : null, searchKeyword, showArchived, viewMode === 'list' ? metricFilter : null), [jobs, viewMode, filterStatus, metricFilter, searchKeyword, showArchived])
  const scopedJobs = useMemo(() => filterJobs(jobs, null, '', showArchived), [jobs, showArchived])
  const state = busy ? 'loading' : error ? 'error' : scopedJobs.length === 0 ? (showArchived ? 'archived' : 'empty') : visibleJobs.length === 0 ? 'filtered' : viewMode

  return (
    <>
      <div className="mx-auto flex h-full min-h-[420px] w-full min-w-0 max-w-[1600px] flex-col gap-3 px-1 py-1 sm:min-h-[700px] sm:gap-5 sm:px-3 sm:py-5 lg:min-h-[760px] lg:px-6">
        <TrackerHeader />
        <OverviewBar />
        <main aria-label="职位工作区" className="flex min-h-0 min-w-0 flex-1 flex-col rounded-2xl border bg-card shadow-xs">
          <TrackerToolbar />
          <ViewTransition animationKey={state} className="flex min-h-0 min-w-0 flex-1 flex-col p-2 sm:p-4">
            {state === 'loading'
              ? <TrackerSkeleton />
              : state === 'board'
                ? <BoardView />
                : state === 'list'
                  ? <div className="flex min-h-0 flex-1 flex-col overflow-y-auto"><ListView /></div>
                  : <TrackerPageState mode={state} onRetry={reload} />}
          </ViewTransition>
        </main>
      </div>
      <JobDrawer />
      <AddJobDrawer />
    </>
  )
}

function Tracker() {
  const scope = useTrackerStore(state => state.accountScope)
  // 账号切换时丢弃局部表单、确认框和退出动画中的旧内容。
  return <TrackerContent key={scope.generation} />
}

export default memo(Tracker)
