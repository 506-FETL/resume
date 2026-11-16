import type { ComponentProps } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface HistoryActionButtonProps extends ComponentProps<typeof Button> {
  label: string
  compact?: boolean
}

export default function HistoryActionButton({
  label,
  children,
  className,
  compact = false,
  ...props
}: HistoryActionButtonProps) {
  return (
    <Button
      size={compact ? 'icon-sm' : 'sm'}
      {...props}
      aria-label={label}
      className={cn('max-md:size-9 max-md:p-0', className)}
    >
      {children}
      {!compact && <span className='hidden md:inline'>{label}</span>}
    </Button>
  )
}
