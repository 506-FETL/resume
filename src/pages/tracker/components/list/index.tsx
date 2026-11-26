import { AnimatePresence } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { memo } from 'react'
import { MoreJobs } from '../more-jobs'
import { PresenceDiv } from '@/components/motion/presence-item'
import { useJobWindow } from '../../hooks/use-job-window'
import { DURATION, EASE, SPRING, staggerDelay } from '@/lib/motion'
import { useSortedJobs } from '../../hooks/use-sorted-jobs'
import type { JobApplication } from '../../types'
import { JobCard } from './job-card'
import { CompanyGroupTitle } from './job-table/company-group-title'

function ListView({ jobs }: { jobs: JobApplication[] }) {
  const reduceMotion = useReducedMotion()

  const { displayJobs, groupByCompany } = useSortedJobs(jobs)
  const { rows, ...page } = useJobWindow(displayJobs)

  return (
    <div className='grid min-w-0 grid-cols-1 content-start'>
      <AnimatePresence initial={false} mode='popLayout'>
        {rows.map((job, index) => (
          <PresenceDiv
            key={job.id}
            layout={reduceMotion ? false : 'position'}
            layoutDependency={rows}
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
      <MoreJobs {...page} />
    </div>
  )
}

export default memo(ListView)
