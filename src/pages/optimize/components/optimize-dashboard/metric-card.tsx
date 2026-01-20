import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  title?: string
  value?: string | number
  subtext?: string
  icon: LucideIcon
  colorClass: string
  loading?: boolean
}

// 颜色映射表
const colorBgMap: Record<string, string> = {
  'text-blue-600': 'bg-blue-50 dark:bg-blue-950/30',
  'text-green-600': 'bg-green-50 dark:bg-green-950/30',
  'text-amber-600': 'bg-amber-50 dark:bg-amber-950/30',
  'text-orange-600': 'bg-orange-50 dark:bg-orange-950/30',
  'text-red-600': 'bg-red-50 dark:bg-red-950/30',
}

export default function MetricCard({ title, value, subtext, icon: Icon, colorClass, loading = false }: MetricCardProps) {
  const bgClass = colorBgMap[colorClass] || 'bg-gray-50 dark:bg-gray-950/30'

  return (
    <Card className="h-full group relative overflow-hidden">
      <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity duration-300">
        <Icon className={cn('w-20 h-20', colorClass)} />
      </div>
      <CardContent className="p-4 md:p-5 flex flex-col h-full relative">
        <div className="flex items-center gap-2 mb-4">
          <div className={cn('p-1.5 rounded-md', bgClass)}>
            <Icon className={cn('w-4 h-4', colorClass)} />
          </div>
          <p className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">{title}</p>
        </div>

        <div className="flex-1 flex flex-col justify-end">
          <div className="mb-1">
            {loading
              ? <Spinner />
              : (
                  <span className={cn('text-3xl font-bold tracking-tight', colorClass)}>
                    {value || '--'}
                  </span>
                )}
          </div>

          {subtext && (
            <p className="text-xs text-muted-foreground/80 leading-relaxed line-clamp-2" title={subtext}>
              {subtext}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
