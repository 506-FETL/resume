import { BellRing, CheckCheck, Send, TrendingUp, Users } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { Skeleton } from '@/components/ui/skeleton'
import { DURATION, EASE } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { useCountUp } from '../../hooks/use-count-up'
import useTrackerStore from '../../store'
import { getTrackerOverviewStats } from '../../utils'
import { MetricCard } from './metric-card'

export default function OverviewBar() {
  const { jobs, loading, error, isInitialized, viewMode, metricFilter, setMetricFilter } = useTrackerStore()
  const reduce = useReducedMotion()
  const stats = getTrackerOverviewStats(jobs)
  const rate = useCountUp(stats.responseRate)
  const busy = loading || (!isInitialized && !error)
  const hasAppliedData = stats.applied > 0 && !error
  const metrics = [
    { key: 'applied', label: '已投递', value: stats.applied, description: '累计投递的职位', icon: Send, iconClassName: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
    { key: 'interview', label: '面试中', value: stats.interview, description: '正在进行的面试流程', icon: Users, iconClassName: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
    { key: 'offer', label: '已录用', value: stats.offer, description: '收到的在办 Offer', icon: CheckCheck, iconClassName: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
    { key: 'pending', label: '待跟进', value: stats.pending, description: '已到期或多日未更新', icon: BellRing, iconClassName: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', accent: true },
  ] as const

  return (
    <section aria-label="求职概览" className="shrink-0 space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {metrics.map(({ key, ...metric }, index) => (
          <MetricCard
            key={key}
            {...metric}
            index={index}
            loading={busy}
            error={Boolean(error)}
            active={metricFilter === key}
            actionLabel={viewMode === 'list' ? '筛选相关职位' : '定位相关阶段'}
            onClick={() => setMetricFilter(key)}
          />
        ))}
      </div>
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
        <span className="hidden sm:inline">历史投递中，进入筛选及后续阶段的占比</span>
        <span className="ml-auto hidden text-[11px] lg:inline">{viewMode === 'list' ? '点击指标筛选职位' : '点击指标定位阶段'}</span>
      </div>
    </section>
  )
}
