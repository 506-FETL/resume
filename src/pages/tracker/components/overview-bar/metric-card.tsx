import type { LucideIcon } from 'lucide-react'
import { ArrowUpRight, Check } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { Skeleton } from '@/components/ui/skeleton'
import { DURATION, EASE } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { useCountUp } from '../../hooks/use-count-up'

interface MetricCardProps {
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
  onClick: () => void
  index: number
}

export function MetricCard({ label, description, value, icon: Icon, iconClassName, active, accent, loading, error, actionLabel, onClick, index }: MetricCardProps) {
  const reduce = useReducedMotion()
  const display = useCountUp(value)

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={loading || error}
      aria-pressed={active}
      aria-label={`${label}：${loading ? '加载中' : error ? '不可用' : value}，${actionLabel}`}
      title={actionLabel}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : DURATION.base, delay: reduce ? 0 : index * 0.03, ease: EASE.out }}
      style={{ transitionDuration: `${reduce ? 0 : DURATION.base}s` }}
      className={cn(
        'group relative min-w-0 rounded-2xl border bg-card p-3.5 text-left shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none sm:p-5',
        active ? 'border-foreground/30 bg-muted/50' : 'border-border/80 hover:border-foreground/20 hover:bg-muted/20',
        accent && value > 0 && !active && 'border-amber-500/25',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground sm:text-sm">{label}</span>
        <span className={cn('flex size-7 items-center justify-center rounded-lg sm:size-8', iconClassName)}><Icon className="size-3.5 sm:size-4" /></span>
      </div>
      <div className="mt-2.5 flex h-8 items-center gap-2 sm:h-9">
        {loading
          ? <Skeleton className={cn('h-8 w-12', reduce && 'animate-none')} />
          : <span className={cn('text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl', error && 'text-muted-foreground', accent && value > 0 && 'text-amber-700 dark:text-amber-400')}>{error ? '—' : display}</span>}
      </div>
      <div className="mt-2 flex items-center justify-between gap-1">
        <p className="truncate text-[11px] text-muted-foreground sm:text-xs">{description}</p>
        {active ? <Check className="size-3.5 shrink-0 text-foreground" /> : <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground/50" />}
      </div>
    </motion.button>
  )
}
