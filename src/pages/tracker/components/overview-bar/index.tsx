import type { TrackerMetricKey } from '../../types'
import { motion, useReducedMotion } from 'motion/react'
import { Skeleton } from '@/components/ui/skeleton'
import { useCountUp } from '../../hooks/use-count-up'
import useTrackerStore from '../../store'
import { getTrackerOverviewStats } from '../../utils'
import { MetricCard } from './metric-card'

interface MetricDef {
  key: TrackerMetricKey
  label: string
  value: number
  accent?: boolean
}

export default function OverviewBar() {
  const { jobs, loading, metricFilter, setMetricFilter } = useTrackerStore()
  const reduce = useReducedMotion()
  const stats = getTrackerOverviewStats(jobs)
  const rate = useCountUp(stats.responseRate)

  if (loading)
    return <Skeleton className="h-20 w-full rounded-xl" />

  if (jobs.length === 0)
    return null

  const hasAppliedData = stats.applied > 0

  const metrics: MetricDef[] = [
    { key: 'applied', label: '已投递', value: stats.applied },
    { key: 'interview', label: '面试中', value: stats.interview },
    { key: 'offer', label: 'Offer', value: stats.offer },
    { key: 'pending', label: '待跟进', value: stats.pending, accent: true },
  ]

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card/60 p-4 sm:flex-row sm:items-stretch">
      {/* Hero：响应率 KPI（不可点） */}
      <div className="flex flex-col justify-center gap-1.5 sm:w-44 sm:shrink-0">
        <span className="text-xs font-medium text-muted-foreground">响应率</span>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold leading-none tabular-nums">
            {hasAppliedData ? rate : '—'}
          </span>
          {hasAppliedData && <span className="text-lg font-semibold text-muted-foreground">%</span>}
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={reduce ? false : { width: 0 }}
            animate={{ width: `${hasAppliedData ? stats.responseRate : 0}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* 竖分隔线 */}
      <div className="hidden w-px shrink-0 bg-border sm:block" />

      {/* 指标区：全部可点 */}
      <div className="grid flex-1 grid-cols-2 gap-2 lg:grid-cols-4">
        {metrics.map((m, i) => (
          <MetricCard
            key={m.key}
            index={i}
            label={m.label}
            value={m.value}
            accent={m.accent}
            active={metricFilter === m.key}
            onClick={() => setMetricFilter(m.key)}
          />
        ))}
      </div>
    </div>
  )
}
