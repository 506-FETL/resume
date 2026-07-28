import type { ApplicationStatus } from '../../types'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import useTrackerStore from '../../store'
import { getTrackerOverviewStats } from '../../utils'

interface MetricItem {
  key: string
  label: string
  value: string | number
  filterStatus?: ApplicationStatus | null
}

export default function OverviewBar() {
  const { jobs, loading, setFilterStatus } = useTrackerStore()

  if (loading) {
    return <Skeleton className="h-16 w-full rounded-xl" />
  }

  if (jobs.length === 0)
    return null

  const stats = getTrackerOverviewStats(jobs)

  const metrics: MetricItem[] = [
    { key: 'applied', label: '已投递', value: stats.applied },
    { key: 'interview', label: '面试中', value: stats.interview, filterStatus: 'interview' },
    { key: 'offer', label: 'Offer', value: stats.offer, filterStatus: 'offer' },
    { key: 'pending', label: '待跟进', value: stats.pending },
    { key: 'rate', label: '响应率', value: `${stats.responseRate}%` },
  ]

  return (
    <div className="grid grid-cols-2 gap-2 rounded-xl border bg-card/60 p-3 sm:grid-cols-3 md:grid-cols-5">
      {metrics.map(m => (
        <button
          key={m.key}
          type="button"
          disabled={m.filterStatus === undefined}
          onClick={() => m.filterStatus !== undefined && setFilterStatus(m.filterStatus)}
          className={cn(
            'flex flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left transition-colors',
            m.filterStatus !== undefined ? 'cursor-pointer hover:bg-muted/60' : 'cursor-default',
          )}
        >
          <span className="text-xs text-muted-foreground">{m.label}</span>
          <span className="text-xl font-semibold tabular-nums">{m.value}</span>
        </button>
      ))}
    </div>
  )
}
