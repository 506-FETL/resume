import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import useShareStore from '../../store'
import { deriveShareStatus } from '../../utils'

export default function Overview() {
  const reduceMotion = useReducedMotion()
  const { allShares, pageLoading, pageError } = useShareStore()

  const metrics = [
    { label: '个分享', value: allShares.length },
    {
      label: '个有效',
      value: allShares.filter((share) => deriveShareStatus(share) === 'active')
        .length,
    },
    {
      label: '次访问',
      value: allShares.reduce((sum, share) => sum + share.view_count, 0),
    },
  ]

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
            {pageLoading ? (
              <Skeleton
                className={cn('h-4 w-5', reduceMotion && 'animate-none')}
              />
            ) : (
              <span className='font-medium text-foreground tabular-nums'>
                {pageError ? '—' : value.toLocaleString()}
              </span>
            )}
            <span>{label}</span>
          </dd>
        </div>
      ))}
    </dl>
  )
}
