import { BellRing, CheckCheck, Send, Users } from 'lucide-react'
import { memo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useIsMobile } from '@/hooks/use-mobile'
import { useTrackerOverview } from '../../hooks/use-tracker-overview'
import useTrackerStore from '../../store'
import { MetricCard } from './metric-card'

function OverviewBar() {
  const isMobile = useIsMobile()
  const { stats, busy, error, showArchived } = useTrackerOverview()

  const { filterStatus, metricFilter, setMetricFilter } = useTrackerStore(
    useShallow((state) => ({
      filterStatus: state.filterStatus,
      metricFilter: state.metricFilter,
      setMetricFilter: state.setMetricFilter,
    })),
  )

  const scopeDescription = showArchived
    ? '当前搜索范围内的已归档职位'
    : '当前搜索范围内的未归档职位'

  const metrics = [
    {
      key: 'applied',
      label: '已投递',
      value: stats.applied,
      description: `${scopeDescription}，已投递或进入后续流程，不含已录用和已结束`,
      icon: Send,
      iconClassName: 'text-blue-600 dark:text-blue-400',
    },
    {
      key: 'interview',
      label: '面试中',
      value: stats.interview,
      description: `${scopeDescription}，当前处于面试阶段`,
      icon: Users,
      iconClassName: 'text-violet-600 dark:text-violet-400',
    },
    {
      key: 'offer',
      label: '已录用',
      value: stats.offer,
      description: `${scopeDescription}，当前已录用`,
      icon: CheckCheck,
      iconClassName: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      key: 'pending',
      label: '待跟进',
      value: stats.pending,
      description:
        '当前搜索范围内已到期或多日未更新的职位，不含已结束、已录用和已归档',
      icon: BellRing,
      iconClassName: 'text-amber-600 dark:text-amber-400',
      accent: true,
    },
  ] as const

  if (isMobile) return null

  return (
    <div
      role='group'
      aria-label='快捷筛选职位'
      aria-busy={busy}
      className='flex min-w-0 flex-wrap items-center gap-1'
    >
      <MetricCard
        metricKey={null}
        label={showArchived ? '全部归档' : '全部职位'}
        description={scopeDescription}
        value={stats.total}
        loading={busy}
        error={error}
        active={metricFilter === null && filterStatus === null}
        onClick={setMetricFilter}
      />
      {metrics.map(({ key, ...metric }) => (
        <MetricCard
          key={key}
          metricKey={key}
          {...metric}
          loading={busy}
          error={error}
          active={metricFilter === key}
          onClick={setMetricFilter}
        />
      ))}
    </div>
  )
}

export default memo(OverviewBar)
