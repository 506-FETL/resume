import { AnimatePresence, useReducedMotion } from 'motion/react'
import { PresenceDiv } from '@/components/motion/presence-item'
import { DURATION, EASE, SPRING, staggerDelay } from '@/lib/motion'
import useTrackerStore from '../../store'
import { filterJobs, sortJobs } from '../../utils'
import { JobCard } from './job-card'
import { JobTable } from './job-table'

export default function ListView() {
  const reduceMotion = useReducedMotion()
  const { jobs, filterStatus, metricFilter, searchKeyword, showArchived, sortBy, sortDir } = useTrackerStore()
  const filteredJobs = sortJobs(filterJobs(jobs, filterStatus, searchKeyword, showArchived, metricFilter), sortBy, sortDir)

  return (
    <>
      <div className="hidden min-h-0 min-w-0 flex-1 flex-col md:flex">
        <JobTable jobs={filteredJobs} />
      </div>
      <div className="grid grid-cols-1 content-start gap-3 md:hidden">
        <AnimatePresence initial={false} mode="popLayout">
          {filteredJobs.map((job, index) => (
            <PresenceDiv
              key={job.id}
              layout={reduceMotion ? false : 'position'}
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
    </>
  )
}
