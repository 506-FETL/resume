import { ShareOverviewSkeleton } from '@/components/page-skeletons/share'
import useShareStore from '../../store'

export default function Overview() {
  const overview = useShareStore((state) => state.overview)
  const loading = useShareStore((state) => state.statsLoading)

  const metrics = [
    { label: '个分享', value: overview?.total },
    { label: '个有效', value: overview?.active },
    { label: '次访问', value: overview?.views },
  ]

  if (loading && !overview) return <ShareOverviewSkeleton />

  return (
    <dl
      className='flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 text-xs text-muted-foreground sm:text-sm'
      aria-label='分享概览'
    >
      {metrics.map(({ label, value }, index) => (
        <div key={label} className='flex items-center gap-1'>
          {index > 0 && (
            <span aria-hidden className='mr-1 text-border'>
              ·
            </span>
          )}
          <dt className='sr-only'>
            {index === 2 ? '累计访问次数，包含重复访问' : label.slice(1)}
          </dt>
          <dd className='inline-flex items-center gap-1'>
            {index === 2 && <span>累计</span>}
            <span className='font-medium text-foreground tabular-nums'>
              {value?.toLocaleString() ?? '—'}
            </span>
            <span>{label}</span>
          </dd>
        </div>
      ))}
    </dl>
  )
}
