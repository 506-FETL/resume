import { CircleCheck, Eye, Link2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import useShareStore from '../../store'
import { deriveShareStatus } from '../../utils'

export default function Overview() {
  const { allShares, pageLoading, pageError } = useShareStore()
  const metrics = [
    { label: '分享链接', value: allShares.length, description: '所有已创建的链接', icon: Link2 },
    { label: '有效链接', value: allShares.filter(share => deriveShareStatus(share) === 'active').length, description: '当前可供访问', icon: CircleCheck },
    { label: '累计访问', value: allShares.reduce((sum, share) => sum + share.view_count, 0), description: '所有链接的访问次数', icon: Eye },
  ]

  return (
    <dl className="grid grid-cols-3 divide-x overflow-hidden rounded-2xl border bg-card shadow-xs">
      {metrics.map(({ label, value, description, icon: Icon }) => (
        <div key={label} className="min-w-0 px-3 py-4 sm:px-6 sm:py-5">
          <dt className="flex items-center gap-2 text-xs text-muted-foreground sm:text-sm">
            <Icon className="hidden size-4 sm:block" />
            {label}
          </dt>
          <dd className="mt-2.5 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">
            {pageLoading ? <Skeleton className="h-9 w-12" /> : pageError ? '—' : value.toLocaleString()}
          </dd>
          <p className="mt-1.5 hidden text-xs text-muted-foreground sm:block">{description}</p>
        </div>
      ))}
    </dl>
  )
}
