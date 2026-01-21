import type { ReactNode } from 'react'
import type { ResumeStats } from '../type'
import { Cloud, CloudOff, FileUser, TrendingUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { NumberTicker } from '@/components/ui/number-ticker'
import { cn } from '@/lib/utils'
import { StatsSkeleton } from './Skeleton'

function StatisticalCard({ stats, loading }: { stats: ResumeStats, loading?: boolean }) {
  if (loading) {
    return <StatsSkeleton />
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
      <StatCard
        title="简历总数"
        value={stats.total}
        description="所有已创建的简历"
        icon={<FileUser className="size-4 text-primary" />}
        iconBg="bg-primary/8"
      />
      <StatCard
        title="云端简历"
        value={stats.online}
        description="已同步到云端"
        icon={<Cloud className="size-4 text-blue-500" />}
        iconBg="bg-blue-500/8"
      />
      <StatCard
        title="本地简历"
        value={stats.offline}
        description="仅存储在本地"
        icon={<CloudOff className="size-4 text-amber-500" />}
        iconBg="bg-amber-500/8"
      />
      <StatCard
        title="近期新增"
        value={stats.recentCount}
        description="最近7天创建"
        icon={<TrendingUp className="size-4 text-emerald-500" />}
        iconBg="bg-emerald-500/8"
        trend={stats.recentCount > 0 ? `+${stats.recentCount}` : undefined}
      />
    </div>
  )
}

export default StatisticalCard

// 统计卡片组件
interface StatCardProps {
  title: string
  value: number
  description: string
  icon: ReactNode
  className?: string
  iconBg?: string
  trend?: string
}

function StatCard({
  title,
  value,
  description,
  icon,
  className,
  iconBg = 'bg-primary/8',
  trend,
}: StatCardProps) {
  return (
    <Card className={cn('transition-all duration-200 hover:shadow-md', className)}>
      <CardContent className="p-4 md:p-5">
        <div className="flex items-start gap-3">
          <div className={cn('p-2 rounded-lg shrink-0', iconBg)}>
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground mb-1">{title}</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-xl md:text-2xl font-semibold tracking-tight">
                <NumberTicker value={value} className="text-xl md:text-2xl font-semibold tracking-tight text-foreground" />
              </h3>
              {trend && (
                <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                  {trend}
                </span>
              )}
            </div>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground/80 truncate">{description}</p>
      </CardContent>
    </Card>
  )
}
