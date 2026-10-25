import type { LucideIcon } from 'lucide-react'
import type { TrackerMetricKey } from '../../types'
import { motion, useReducedMotion } from 'motion/react'
import { memo } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { DURATION, EASE } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { useCountUp } from '../../hooks/use-count-up'

interface MetricCardProps {
  metricKey: TrackerMetricKey
  label: string
  description: string
  value: number
  icon: LucideIcon
  iconClassName: string
  active: boolean
  accent?: boolean
  loading: boolean
  error: boolean
  actionLabel: string
  onClick: (key: TrackerMetricKey) => void
  index: number
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
  actionLabel,
  onClick,
  index,
}: MetricCardProps) {
  const reduce = useReducedMotion()
  const display = useCountUp(value, DURATION.slow * 1000)
  const accessibleLabel = `${label}：${loading ? '加载中' : error ? '不可用' : `${value} 个职位`}，${active ? '再次点击取消选中' : actionLabel}`

  return (
    <motion.button
      type='button'
      onClick={() => onClick(metricKey)}
      disabled={loading || error}
      aria-pressed={active}
      aria-label={accessibleLabel}
      title={`${description}，${actionLabel}`}
      initial={reduce ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduce ? 0 : DURATION.base,
        delay: reduce ? 0 : index * 0.03,
        ease: EASE.out,
      }}
      style={{
        transitionDuration: `${reduce ? 0 : DURATION.fast}s`,
        transitionTimingFunction: `cubic-bezier(${EASE.out.join(',')})`,
      }}
      className={cn(
        'inline-flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-lg border border-transparent px-1 text-muted-foreground transition-[color,background-color,border-color,box-shadow] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none sm:gap-2 sm:px-3',
        active
          ? 'border-border bg-background text-foreground shadow-xs'
          : 'hover:bg-muted/60 hover:text-foreground',
      )}
    >
      <span
        className={cn(
          'hidden size-6 shrink-0 items-center justify-center rounded-md sm:inline-flex',
          iconClassName,
        )}
      >
        <Icon aria-hidden className='size-3.5' />
      </span>
      <span className='shrink-0 whitespace-nowrap text-xs font-medium'>
        {label}
      </span>
      {loading ? (
        <Skeleton
          className={cn('h-4 w-5 shrink-0', reduce && 'animate-none')}
        />
      ) : (
        <span
          className={cn(
            'min-w-0 truncate text-sm font-semibold tabular-nums text-foreground sm:text-lg',
            error && 'text-muted-foreground',
            accent && value > 0 && 'text-amber-700 dark:text-amber-400',
          )}
        >
          {error ? '—' : display}
        </span>
      )}
    </motion.button>
  )
}

export const MetricCard = memo(MetricCardComponent)
