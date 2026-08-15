import type { TrackerMetricKey } from '../../types'
import { ChevronDown } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
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
  const [mobileExpanded, setMobileExpanded] = useState(false)
  const stats = getTrackerOverviewStats(jobs)
  const rate = useCountUp(stats.responseRate)

  if (loading)
    return <Skeleton className="h-18 w-full rounded-xl md:h-20" />

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
    <>
      <div className="overflow-hidden rounded-xl border bg-card/60 md:hidden">
        <div className="flex min-h-16 items-stretch gap-1 px-2 py-2">
          <div className="flex w-16 shrink-0 flex-col justify-center px-1">
            <span className="text-[10px] font-medium text-muted-foreground">响应率</span>
            <div className="flex items-baseline gap-0.5">
              <span className="text-xl font-bold leading-none tabular-nums">
                {hasAppliedData ? rate : '—'}
              </span>
              {hasAppliedData && <span className="text-xs font-semibold text-muted-foreground">%</span>}
            </div>
          </div>

          <div className="my-1 w-px shrink-0 bg-border" />

          <div className="grid min-w-0 flex-1 grid-cols-3">
            {metrics.slice(0, 3).map(metric => (
              <button
                key={metric.key}
                type="button"
                aria-pressed={metricFilter === metric.key}
                className={cn(
                  'flex min-w-0 flex-col items-center justify-center rounded-lg border px-1 py-1 transition-colors',
                  metricFilter === metric.key
                    ? 'border-primary/50 bg-primary/5 text-foreground shadow-inner'
                    : 'border-transparent hover:bg-muted/70 active:bg-muted',
                )}
                onClick={() => setMetricFilter(metric.key)}
              >
                <span className="text-[10px] text-muted-foreground">
                  {metric.label}
                </span>
                <span className="text-base font-semibold leading-tight tabular-nums">{metric.value}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            className="flex w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={mobileExpanded ? '收起完整统计' : '展开完整统计'}
            aria-expanded={mobileExpanded}
            onClick={() => setMobileExpanded(value => !value)}
          >
            <ChevronDown className={cn('size-4 transition-transform', mobileExpanded && 'rotate-180')} />
          </button>
        </div>

        <AnimatePresence initial={false}>
          {mobileExpanded && (
            <motion.div
              key="mobile-overview-details"
              initial={reduce ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
              transition={reduce ? { duration: 0 } : { duration: 0.2, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <div className="border-t px-2 py-2">
                <button
                  type="button"
                  aria-pressed={metricFilter === 'pending'}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    metricFilter === 'pending'
                      ? 'border-primary/50 bg-primary/5 text-foreground shadow-inner'
                      : 'border-transparent bg-muted/50',
                  )}
                  onClick={() => setMetricFilter('pending')}
                >
                  <span className="text-[10px] text-muted-foreground">待跟进</span>
                  <span className="font-semibold tabular-nums">{stats.pending}</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="hidden flex-col gap-3 rounded-xl border bg-card/60 p-4 md:flex md:flex-row md:items-stretch">
        {/* Hero：响应率 KPI（不可点） */}
        <div className="flex flex-col justify-center gap-1.5 md:w-44 md:shrink-0">
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

        <div className="w-px shrink-0 bg-border" />

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
    </>
  )
}
