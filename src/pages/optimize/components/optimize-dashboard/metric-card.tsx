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

export default function MetricCard({ title, value, subtext, icon: Icon, colorClass, loading = false }: MetricCardProps) {
  return (
    <Card className="h-full group relative overflow-hidden shadow-sm border-primary/20 hover:shadow-md transition-all duration-300">
      <div className="absolute top-0 right-0 p-3 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity duration-300 transform ">
        <Icon className={cn('w-28 h-28', colorClass)} />
      </div>
      <CardContent className="p-5 flex flex-col h-full relative z-10">
        <div className="flex items-center gap-2 mb-4">
          <div className={cn('p-1.5 rounded-md bg-muted/50')}>
            <Icon className={cn('w-4 h-4', colorClass)} />
          </div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
        </div>

        <div className="flex-1 flex flex-col justify-end">
          <div className="mb-2">
            {loading
              ? <Spinner className="w-6 h-6" />
              : (
                  <span className={cn('text-4xl font-bold tracking-tight', colorClass)}>
                    {value || '--'}
                  </span>
                )}
          </div>

          {subtext && (
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2" title={subtext}>
              {subtext}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
