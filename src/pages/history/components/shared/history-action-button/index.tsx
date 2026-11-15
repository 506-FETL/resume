import type { ComponentProps } from 'react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useIsMobile } from '@/hooks/use-mobile'
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
  const isMobile = useIsMobile()
  const needsTooltip = compact || isMobile || (!!title && title !== label)

  const button = (
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

  if (!needsTooltip) return button

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {props.disabled ? (
          <span className='inline-flex' tabIndex={needsTooltip ? 0 : undefined}>
            {button}
          </span>
        ) : (
          button
        )}
      </TooltipTrigger>
      <TooltipContent
        style={{ animationDuration: reduceMotion ? '0s' : undefined }}
      >
        {title || label}
      </TooltipContent>
    </Tooltip>
  )
}
