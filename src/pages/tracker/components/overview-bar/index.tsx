import { BellRing, CheckCheck, Send, TrendingUp, Users } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { memo, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Skeleton } from '@/components/ui/skeleton'
import { useIsMobile } from '@/hooks/use-mobile'
import { DURATION, EASE } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { useCountUp } from '../../hooks/use-count-up'
import useTrackerStore from '../../store'
import { selectTrackerListJobs } from '../../store/selectors'
import { getTrackerOverviewStats } from '../../utils'
import { MetricCard } from './metric-card'

function OverviewBar() {
  const jobs = useTrackerStore(selectTrackerListJobs)
  const { loading, error, isInitialized, viewMode, metricFilter, setMetricFilter } = useTrackerStore(useShallow(state => ({
    loading: state.loading,
    error: Boolean(state.error),
    isInitialized: state.isInitialized,
    viewMode: state.viewMode,
    metricFilter: state.metricFilter,
    setMetricFilter: state.setMetricFilter,
  })))
  const isMobile = useIsMobile()
  const reduce = useReducedMotion()
  const stats = useMemo(() => getTrackerOverviewStats(jobs), [jobs])
  const rate = useCountUp(isMobile ? 0 : stats.responseRate, DURATION.slow * 1000)
  const busy = loading || (!isInitialized && !error)
  const hasAppliedData = stats.applied > 0 && !error
  const metrics = [
    { key: 'applied', label: '已投递', value: stats.applied, description: '含已结束和已归档职位', icon: Send, iconClassName: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
    { key: 'interview', label: '面试中', value: stats.interview, description: '不含已归档职位', icon: Users, iconClassName: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
    { key: 'offer', label: '已录用', value: stats.offer, description: '不含已归档职位', icon: CheckCheck, iconClassName: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
    { key: 'pending', label: '待跟进', value: stats.pending, description: '已到期或多日未更新', icon: BellRing, iconClassName: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', accent: true },
  ] as const

  return (
    <section aria-label="求职概览" aria-busy={busy} className={cn('shrink-0', !isMobile && 'space-y-2')}>
      <div
        role="group"
        aria-label={viewMode === 'list' ? '按求职指标筛选' : '按求职指标定位阶段'}
        className={cn('grid grid-cols-4', isMobile ? 'gap-0.5 rounded-xl border border-border/70 bg-muted/35 p-1' : 'gap-3')}
      >
        {metrics.map(({ key, ...metric }, index) => (
          <MetricCard
            key={key}
            metricKey={key}
            {...metric}
            compact={isMobile}
            index={index}
            loading={busy}
            error={error}
            active={metricFilter === key}
            actionLabel={viewMode === 'list' ? '筛选相关职位' : '定位相关阶段'}
            onClick={setMetricFilter}
          />
        ))}
      </div>
      {!isMobile && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="size-3.5" />
            <span>响应率</span>
            {busy
              ? <Skeleton className={cn('h-4 w-9', reduce && 'animate-none')} />
              : <span className="font-semibold tabular-nums text-foreground">{hasAppliedData ? `${rate}%` : '—'}</span>}
          </div>
          <div aria-hidden="true" className="h-1 w-20 overflow-hidden rounded-full bg-muted sm:w-28">
            <motion.div
              className="h-full rounded-full bg-foreground/60"
              initial={false}
              animate={{ width: `${hasAppliedData && !busy ? stats.responseRate : 0}%` }}
              transition={{ duration: reduce ? 0 : DURATION.slow, ease: EASE.out }}
            />
          </div>
          <span className="hidden sm:inline">历史投递中，进入测评及后续阶段的占比</span>
        </div>
      )}
    </section>
  )
}

export default memo(OverviewBar)
