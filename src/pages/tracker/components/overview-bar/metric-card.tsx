import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'
import { useCountUp } from '../../hooks/use-count-up'

interface MetricCardProps {
  label: string
  value: number
  active: boolean
  accent?: boolean // 待跟进 >0 时高亮
  onClick: () => void
  index: number
}

export function MetricCard({ label, value, active, accent, onClick, index }: MetricCardProps) {
  const reduce = useReducedMotion()
  const display = useCountUp(value)

  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.04 }}
      whileTap={reduce ? undefined : { scale: 0.97 }}
      className={cn(
        'relative flex flex-col items-start gap-0.5 overflow-hidden rounded-lg border px-3 py-2 text-left transition-colors',
        active
          ? 'border-primary/50 bg-primary/5 ring-2 ring-primary/30'
          : 'border-transparent hover:bg-muted/60',
      )}
    >
      {active && <span className="absolute inset-x-0 top-0 h-0.5 bg-primary" />}
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn(
        'text-xl font-semibold tabular-nums',
        accent && value > 0 && 'text-amber-600',
      )}
      >
        {display}
      </span>
    </motion.button>
  )
}
