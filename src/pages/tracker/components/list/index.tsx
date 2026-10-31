import { AnimatePresence } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { memo, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { PresenceDiv } from '@/components/motion/presence-item'
import { useIsMobile } from '@/hooks/use-mobile'
import { DURATION, EASE, SPRING, staggerDelay } from '@/lib/motion'
import useTrackerStore from '../../store'
import { selectTrackerListJobs } from '../../store/selectors'
import { filterJobs, sortJobs } from '../../utils'
import { JobCard } from './job-card'
import { CompanyGroupTitle, JobTable } from './job-table'

function ListView() {
  const reduceMotion = useReducedMotion()
  const isMobile = useIsMobile()

  const {
    jobs,
    filterStatus,
    metricFilter,
    searchKeyword,
    showArchived,
    sortBy,
    sortDir,
    filterCompanyId,
    focusedOnly,
    groupByCompany,
  } = useTrackerStore(
    useShallow((state) => ({
      jobs: selectTrackerListJobs(state),
      filterStatus: state.filterStatus,
      metricFilter: state.metricFilter,
      searchKeyword: state.searchKeyword,
      showArchived: state.showArchived,
      sortBy: state.sortBy,
      sortDir: state.sortDir,
      filterCompanyId: state.filterCompanyId,
      focusedOnly: state.focusedOnly,
      groupByCompany: state.groupByCompany,
    })),
  )

  const filteredJobs = useMemo(
    () =>
      sortJobs(
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
        sortBy,
        sortDir,
      ),
    [
      jobs,
      filterStatus,
      metricFilter,
      searchKeyword,
      showArchived,
      sortBy,
      sortDir,
      filterCompanyId,
      focusedOnly,
    ],
  )

  const displayJobs = useMemo(() => {
    if (!groupByCompany) return filteredJobs

    const groups = new Map<string, typeof filteredJobs>()

    for (const job of filteredJobs) {
      const group = groups.get(job.tracker_company_id) ?? []

      group.push(job)
      groups.set(job.tracker_company_id, group)
    }

    return [...groups.values()].flat()
  }, [filteredJobs, groupByCompany])

  if (!isMobile)
    return <JobTable jobs={displayJobs} groupByCompany={groupByCompany} />

  return (
    <div className='grid min-w-0 grid-cols-1 content-start'>
      <AnimatePresence initial={false} mode='popLayout'>
        {displayJobs.map((job, index) => (
          <PresenceDiv
            key={job.id}
            layout={reduceMotion ? false : 'position'}
            layoutDependency={displayJobs}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{
              opacity: 0,
              transition: {
                duration: reduceMotion ? 0 : DURATION.fast,
                ease: EASE.in,
              },
            }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : {
                    duration: DURATION.base,
                    ease: EASE.out,
                    delay: staggerDelay(Math.min(index, 8)),
                    layout: SPRING.layout,
                  }
            }
          >
            {groupByCompany &&
              displayJobs[index - 1]?.tracker_company_id !==
                job.tracker_company_id && (
                <div className='px-1 pt-5 pb-2'>
                  <CompanyGroupTitle job={job} />
                </div>
              )}
            <JobCard job={job} />
          </PresenceDiv>
        ))}
      </AnimatePresence>
    </div>
  )
}

export default memo(ListView)
