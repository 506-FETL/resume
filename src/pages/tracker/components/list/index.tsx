import { AnimatePresence, useReducedMotion } from 'motion/react'
import { memo, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { PresenceDiv } from '@/components/motion/presence-item'
import { useIsMobile } from '@/hooks/use-mobile'
import { DURATION, EASE, SPRING, staggerDelay } from '@/lib/motion'
import useTrackerStore from '../../store'
import { selectTrackerListJobs } from '../../store/selectors'
import { filterJobs, sortJobs } from '../../utils'
import { JobCard } from './job-card'
import { JobTable } from './job-table'

function ListView() {
  const reduceMotion = useReducedMotion()
  const isMobile = useIsMobile()
  const { jobs, filterStatus, metricFilter, searchKeyword, showArchived, sortBy, sortDir } = useTrackerStore(useShallow(state => ({
    jobs: selectTrackerListJobs(state),
    filterStatus: state.filterStatus,
    metricFilter: state.metricFilter,
    searchKeyword: state.searchKeyword,
    showArchived: state.showArchived,
    sortBy: state.sortBy,
    sortDir: state.sortDir,
  })))
  const filteredJobs = useMemo(() => sortJobs(filterJobs(jobs, filterStatus, searchKeyword, showArchived, metricFilter), sortBy, sortDir), [jobs, filterStatus, metricFilter, searchKeyword, showArchived, sortBy, sortDir])

  if (!isMobile)
    return <JobTable jobs={filteredJobs} />

  return (
    <div className="grid grid-cols-1 content-start gap-2">
      <AnimatePresence initial={false} mode="popLayout">
        {filteredJobs.map((job, index) => (
          <PresenceDiv
            key={job.id}
            layout={reduceMotion ? false : 'position'}
            layoutDependency={filteredJobs}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: reduceMotion ? 0 : DURATION.fast, ease: EASE.in } }}
            transition={reduceMotion ? { duration: 0 } : { duration: DURATION.base, ease: EASE.out, delay: staggerDelay(Math.min(index, 8)), layout: SPRING.layout }}
          >
            <JobCard job={job} />
          </PresenceDiv>
        ))}
      </AnimatePresence>
    </div>
  )
}

export default memo(ListView)
