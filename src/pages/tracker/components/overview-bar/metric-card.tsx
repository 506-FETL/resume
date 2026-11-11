import type { LucideIcon } from 'lucide-react'
import type { TrackerMetricKey } from '../../types'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DURATION, EASE } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { useCountUp } from '../../hooks/use-count-up'

interface MetricCardProps {
  metricKey: TrackerMetricKey | null
  label: string
  description: string
  value: number
  icon?: LucideIcon
  iconClassName?: string
  active: boolean
  accent?: boolean
  loading: boolean
  error: boolean
  onClick: (key: TrackerMetricKey | null) => void
}

function MetricCardComponent({
  metricKey,
  label,
  description,
  value,
  icon: Icon,
  iconClassName,
  active,
  accent,
  loading,
  error,
  onClick,
}: MetricCardProps) {
  const reduce = useReducedMotion()
  const display = useCountUp(value)

  const actionLabel =
    metricKey === null
      ? '显示全部阶段'
      : active
        ? '再次点击取消筛选'
        : '筛选相关职位'

  const accessibleLabel = `${label}：${loading ? '加载中' : error ? '不可用' : `${value} 个职位`}，${actionLabel}`

  return (
    <Button
      type='button'
      variant='ghost'
      size='sm'
      onClick={() => onClick(metricKey)}
      disabled={loading || error}
      aria-pressed={active}
      aria-label={accessibleLabel}
      title={`${description}，${actionLabel}`}
      style={{
        transitionDuration: `${reduce ? 0 : DURATION.fast}s`,
        transitionTimingFunction: `cubic-bezier(${EASE.out.join(',')})`,
      }}
      className={cn(
        'h-9 min-w-0 gap-2 rounded-lg px-3 text-muted-foreground',
        active
          ? 'border-border/70 bg-muted text-foreground'
          : 'hover:bg-muted/60',
      )}
    >
      {Icon && <Icon aria-hidden className={cn('size-3.5', iconClassName)} />}
      <span>{label}</span>
      {loading ? (
        <Skeleton
          className={cn('h-4 w-5 shrink-0', reduce && 'animate-none')}
        />
      ) : (
        <span
          className={cn(
            'text-xs font-medium tabular-nums text-muted-foreground',
            active && 'text-foreground',
            error && 'text-muted-foreground',
            accent && value > 0 && 'text-amber-700 dark:text-amber-400',
          )}
        >
          {error ? '—' : display}
        </span>
      )}
    </Button>
  )
}

export const MetricCard = memo(MetricCardComponent)
