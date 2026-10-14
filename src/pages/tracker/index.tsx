import AnimatedContent from '@/components/motion/animated-content'
import BoardView from './components/board'
import JobDrawer from './components/drawer'
import AddJobDrawer from './components/drawer/add-job'
import TrackerHeader from './components/header'
import ListView from './components/list'
import OverviewBar from './components/overview-bar'
import { TrackerPageState, TrackerSkeleton } from './components/page-state'
import TrackerToolbar from './components/toolbar'
import { useTrackerJobs } from './hooks/use-tracker-jobs'
import useTrackerStore from './store'
import { filterJobs } from './utils'

function Tracker() {
  const { jobs, viewMode, loading, error, isInitialized, showArchived, filterStatus, metricFilter, searchKeyword } = useTrackerStore()
  const { reload } = useTrackerJobs()
  const busy = loading || (!isInitialized && !error)
  const visibleJobs = filterJobs(jobs, viewMode === 'list' ? filterStatus : null, searchKeyword, showArchived, viewMode === 'list' ? metricFilter : null)
  const scopedJobs = filterJobs(jobs, null, '', showArchived)
  const state = busy ? 'loading' : error ? 'error' : scopedJobs.length === 0 ? (showArchived ? 'archived' : 'empty') : visibleJobs.length === 0 ? 'filtered' : viewMode

  return (
    <>
      <div className="mx-auto flex min-h-full w-full min-w-0 max-w-[1600px] flex-col gap-6 px-1 py-3 sm:px-3 sm:py-5 lg:h-full lg:min-h-[760px] lg:px-6">
        <TrackerHeader />
        <OverviewBar />
        <main aria-label="职位工作区" className="flex min-h-[360px] min-w-0 flex-1 flex-col rounded-2xl border bg-card shadow-xs">
          <TrackerToolbar />
          <AnimatedContent animationKey={state} className="flex min-h-0 min-w-0 flex-1 flex-col p-3 sm:p-4">
            {state === 'loading'
              ? <TrackerSkeleton />
              : state === 'board'
                ? <BoardView />
                : state === 'list'
                  ? <div className="flex min-h-0 flex-1 flex-col overflow-y-auto"><ListView /></div>
                  : <TrackerPageState mode={state} onRetry={reload} />}
          </AnimatedContent>
        </main>
      </div>
      <JobDrawer />
      <AddJobDrawer />
    </>
  )
}

export default Tracker
