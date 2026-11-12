import { cn } from '@/lib/utils'
import { useReducedMotion } from '@/hooks/use-reduced-motion'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  const reduced = useReducedMotion()

  return (
    <div
      data-slot='skeleton'
      aria-hidden='true'
      className={cn(
        'rounded-md bg-muted',
        !reduced && 'animate-pulse',
        className,
      )}
      {...props}
    />
  )
}

export { Skeleton }
