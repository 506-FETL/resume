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

  const { viewMode, metricFilter, setMetricFilter } = useTrackerStore(
    useShallow((state) => ({
      viewMode: state.viewMode,
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
      description: `${scopeDescription}，当前处于已投递阶段`,
      icon: Send,
      iconClassName: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    },
    {
      key: 'interview',
      label: '面试中',
      value: stats.interview,
      description: `${scopeDescription}，当前处于面试阶段`,
      icon: Users,
      iconClassName: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    },
    {
      key: 'offer',
      label: '已录用',
      value: stats.offer,
      description: `${scopeDescription}，当前已录用`,
      icon: CheckCheck,
      iconClassName: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    },
    {
      key: 'pending',
      label: '待跟进',
      value: stats.pending,
      description:
        '当前搜索范围内已到期或多日未更新的职位，不含已结束、已录用和已归档',
      icon: BellRing,
      iconClassName: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      accent: true,
    },
  ] as const

  if (isMobile) return null

  return (
    <section
      aria-label='求职概览'
      aria-busy={busy}
      className='shrink-0 border-b bg-muted/15 px-1 py-1 sm:px-2'
    >
      <div
        role='group'
        aria-label={
          viewMode === 'list' ? '按求职指标筛选' : '按求职指标定位阶段'
        }
        className='grid grid-cols-4 gap-1'
      >
        {metrics.map(({ key, ...metric }, index) => (
          <MetricCard
            key={key}
            metricKey={key}
            {...metric}
            index={index}
            loading={busy}
            error={error}
            active={metricFilter === key}
            actionLabel={viewMode === 'list' ? '筛选相关职位' : '定位相关阶段'}
            onClick={setMetricFilter}
          />
        ))}
      </div>
    </section>
  )
}

export default memo(OverviewBar)
