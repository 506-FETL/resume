import { FilterX, Plus, SearchX } from 'lucide-react'
import { AnimatePresence, useReducedMotion } from 'motion/react'
import AnimatedContent from '@/components/motion/animated-content'
import { PresenceDiv } from '@/components/motion/presence-item'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DURATION, EASE, SPRING } from '@/lib/motion'
import { APPLICATION_STATUS_CONFIG } from '../../const'
import useTrackerStore from '../../store'
import { filterJobs, sortJobs } from '../../utils'
import { JobCard } from './job-card'
import { JobTable } from './job-table'

const LIST_SKELETON_KEYS = ['list-skeleton-1', 'list-skeleton-2', 'list-skeleton-3', 'list-skeleton-4'] as const

const METRIC_LABELS: Record<'applied' | 'interview' | 'offer' | 'pending', string> = {
  applied: '已投递',
  interview: '面试中',
  offer: 'Offer',
  pending: '待跟进',
}

export default function ListView() {
  const reduceMotion = useReducedMotion()
  const { jobs, loading, filterStatus, metricFilter, searchKeyword, showArchived, sortBy, sortDir, setSearchKeyword, clearFilters, openAddDrawer } = useTrackerStore()

  const filteredJobs = sortJobs(filterJobs(jobs, filterStatus, searchKeyword, showArchived, metricFilter), sortBy, sortDir)
  const hasFilter = filterStatus !== null || metricFilter !== null || searchKeyword.trim() !== ''

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col gap-2">
          {LIST_SKELETON_KEYS.map(key => (
            <Skeleton key={key} className="h-12 w-full rounded-md" />
          ))}
        </div>
      )
    }

    if (jobs.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed bg-card/60 px-6 py-16 text-center">
          <div className="mx-auto flex max-w-md flex-col items-center gap-3">
            <h2 className="text-lg font-semibold tracking-tight">还没有职位记录</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              把每一个想投的岗位先记进来，后续投递、面试、复盘都能围绕它推进。
            </p>
            <Button onClick={openAddDrawer}>
              <Plus />
              新增第一个职位
            </Button>
          </div>
        </div>
      )
    }

    if (filteredJobs.length === 0) {
      return (
        <div className="rounded-2xl border bg-card/60 px-6 py-12 text-center">
          <div className="mx-auto flex max-w-md flex-col items-center gap-3">
            <SearchX className="size-8 text-muted-foreground" />
            <h2 className="text-base font-semibold tracking-tight">
              当前
              {filterStatus ? `「${APPLICATION_STATUS_CONFIG[filterStatus].label}」` : ''}
              {metricFilter ? `「${METRIC_LABELS[metricFilter]}」` : ''}
              筛选下没有匹配的职位
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              可以清除筛选条件或新增一条记录。
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {hasFilter && (
                <Button
                  variant="outline"
                  onClick={() => {
                    clearFilters()
                    setSearchKeyword('')
                  }}
                >
                  <FilterX />
                  清除筛选
                </Button>
              )}
              <Button onClick={openAddDrawer}>
                <Plus />
                新增职位
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <>
        <div className="hidden md:block">
          <JobTable jobs={filteredJobs} />
        </div>
        <div className="grid grid-cols-1 gap-2 md:hidden">
          <AnimatePresence initial={false} mode="popLayout">
            {filteredJobs.map(job => (
              <PresenceDiv
                key={job.id}
                layout={reduceMotion ? false : 'position'}
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: reduceMotion ? 0 : DURATION.fast, ease: EASE.in } }}
                transition={reduceMotion ? { duration: 0 } : { duration: DURATION.base, ease: EASE.out, layout: SPRING.layout }}
              >
                <JobCard job={job} />
              </PresenceDiv>
            ))}
          </AnimatePresence>
        </div>
      </>
    )
  }

  return (
    <AnimatedContent animationKey={loading ? 'loading' : jobs.length === 0 ? 'empty' : filteredJobs.length === 0 ? 'filtered-empty' : 'jobs'}>
      {renderContent()}
    </AnimatedContent>
  )
}
