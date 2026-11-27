import { useDelayedBusy } from '@/hooks/use-delayed-busy'
import { cn } from '@/lib/utils'

export function LoadingStatus({
  label,
  className,
}: {
  label: string
  className?: string
}) {
  const visible = useDelayedBusy(true)

  return (
    <div
      role='status'
      aria-busy='true'
      className={cn('px-3 py-2 text-sm text-muted-foreground', className)}
    >
      <span className={visible ? undefined : 'sr-only'}>{label}</span>
    </div>
  )
}
