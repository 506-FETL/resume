import type { ToolVisualDefinition } from './config'
import { ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ToolCardProps {
  disabled: boolean
  onClick: () => void
  tool: ToolVisualDefinition
}

export function ToolCard({ disabled, onClick, tool }: ToolCardProps) {
  const Icon = tool.icon

  return (
    <Button
      variant='ghost'
      className={cn(
        'group h-auto min-h-0 w-full items-stretch justify-start rounded-none whitespace-normal border-0 border-b border-border/60 p-0 text-left hover:bg-muted/30',
        disabled && 'cursor-not-allowed opacity-60',
      )}
      disabled={disabled}
      onClick={onClick}
    >
      <div className='flex min-w-0 w-full items-center gap-3 px-2 py-4'>
        <div
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-md',
            tool.iconClassName,
          )}
        >
          <Icon className='size-4' />
        </div>

        <div className='min-w-0 flex-1 space-y-1'>
          <div className='flex min-w-0 flex-wrap items-center gap-2'>
            <span className='min-w-0 wrap-break-word text-sm font-semibold text-foreground'>
              {tool.title}
            </span>
          </div>
          {tool.description && (
            <p className='wrap-break-word text-xs leading-5 text-muted-foreground'>
              {tool.description}
            </p>
          )}
        </div>

        <ArrowUpRight className='mt-0.5 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary' />
      </div>
    </Button>
  )
}
