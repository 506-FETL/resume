import { Archive, X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { getCompanies } from '@/lib/supabase/resume'
import BoardView from './components/board/index'
import JobDrawer from './components/drawer'
import AddJobDrawer from './components/drawer/add-job'
import TrackerHeader from './components/header'
import ListView from './components/list'
import OverviewBar from './components/overview-bar'
import useTrackerStore from './store'
import { getTrackerLoadErrorMeta } from './utils'

const TRACKER_SKELETON_KEYS = ['tracker-skeleton-1', 'tracker-skeleton-2', 'tracker-skeleton-3'] as const

function Tracker() {
  const { viewMode, loading, showArchived, setShowArchived } = useTrackerStore()
  const reduce = useReducedMotion()

  useEffect(() => {
    const currentState = useTrackerStore.getState()
    if (currentState.isInitialized || currentState.loading)
      return

    const loadJobs = async () => {
      useTrackerStore.setState({ loading: true, error: null })

      try {
        const jobs = await getCompanies()
        useTrackerStore.setState({ jobs, loading: false, error: null, isInitialized: true })
      }
      catch (error) {
        const { message, description } = getTrackerLoadErrorMeta(error)
        useTrackerStore.setState({ loading: false, error: message })
        toast.error(message, { description })
      }
    }

    loadJobs()
  }, [])

  const renderMainContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col gap-3">
          {TRACKER_SKELETON_KEYS.map(key => (
            <Skeleton key={key} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      )
    }

    return viewMode === 'list' ? <ListView /> : <BoardView />
  }

  return (
    <>
      <div className="mx-auto flex w-full max-w-360 flex-col gap-4 px-4 py-4 md:px-6 md:py-5 lg:px-10 lg:py-6 2xl:max-w-[1720px]">
        <TrackerHeader />
        <OverviewBar />
        <AnimatePresence initial={false}>
          {showArchived && (
            <motion.div
              initial={reduce ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={reduce ? undefined : { opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <span className="inline-flex items-center gap-1.5">
                  <Archive className="size-4" />
                  正在查看已归档职位
                </span>
                <button
                  type="button"
                  onClick={() => setShowArchived(false)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium hover:bg-amber-100"
                >
                  <X className="size-3.5" />
                  退出
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <main className="w-full min-w-0">
          {renderMainContent()}
        </main>
      </div>

      <JobDrawer />
      <AddJobDrawer />
    </>
  )
}

export default Tracker
