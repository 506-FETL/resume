import { CircleCheck, Eye, Link2 } from 'lucide-react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import useShareStore from '../../store'
import { deriveShareStatus } from '../../utils'

export default function Overview() {
  const reduceMotion = useReducedMotion()
  const { allShares, pageLoading, pageError } = useShareStore()

  const metrics = [
    { label: '分享链接', value: allShares.length, icon: Link2 },
    {
      label: '有效链接',
      value: allShares.filter((share) => deriveShareStatus(share) === 'active')
        .length,
      icon: CircleCheck,
    },
    {
      label: '累计访问',
      value: allShares.reduce((sum, share) => sum + share.view_count, 0),
      icon: Eye,
    },
  ]

  return (
    <dl className='flex flex-wrap gap-x-8 gap-y-3 border-b pb-5'>
      {metrics.map(({ label, value, icon: Icon }) => (
        <div key={label} className='flex min-w-0 items-center gap-3'>
          <dt className='flex items-center gap-2 text-xs leading-4.5 text-muted-foreground'>
            <Icon className='hidden size-4 sm:block' />
            {label}
          </dt>
          <dd className='text-lg font-semibold tabular-nums'>
            {pageLoading ? (
              <Skeleton
                className={cn('h-5 w-8', reduceMotion && 'animate-none')}
              />
            ) : pageError ? (
              '—'
            ) : (
              value.toLocaleString()
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}
