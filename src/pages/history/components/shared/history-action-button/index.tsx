import type { ComponentProps } from 'react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { cn } from '@/lib/utils'

interface HistoryActionButtonProps extends ComponentProps<typeof Button> {
  label: string
  compact?: boolean
}

export default function HistoryActionButton({
  label,
  children,
  className,
  title,
  compact = false,
  ...props
}: HistoryActionButtonProps) {
  const reduceMotion = useReducedMotion()

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size={compact ? 'icon-sm' : 'sm'}
          {...props}
          aria-label={label}
          className={cn('max-md:size-9 max-md:p-0', className)}
        >
          {children}
          {!compact && <span className='hidden md:inline'>{label}</span>}
        </Button>
      </TooltipTrigger>
      <TooltipContent
        style={{ animationDuration: reduceMotion ? '0s' : undefined }}
      >
        {title || label}
      </TooltipContent>
    </Tooltip>
  )
}
