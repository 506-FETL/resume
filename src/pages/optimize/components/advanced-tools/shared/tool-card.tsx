import type { ToolVisualDefinition } from './config'
import { ArrowUpRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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
      variant="outline"
      className={cn(
        'group h-auto min-h-0 w-full items-stretch justify-start whitespace-normal border-border/60 bg-card p-0 text-left shadow-none transition-colors hover:border-primary/25 hover:bg-muted/30',
        disabled && 'cursor-not-allowed opacity-60',
      )}
      disabled={disabled}
      onClick={onClick}
    >
      <div className="flex min-w-0 w-full items-start gap-3 p-4">
        <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', tool.iconClassName)}>
          <Icon className="size-4" />
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="min-w-0 wrap-break-word text-sm font-semibold text-foreground">{tool.title}</span>
            <Badge className={cn('max-w-full rounded-full border px-2 py-0 text-[10px] font-medium', tool.badgeClassName)}>
              {tool.badge}
            </Badge>
          </div>
          <p className="line-clamp-2 wrap-break-word text-xs leading-5 text-muted-foreground">{tool.description}</p>
        </div>

        <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
      </div>
    </Button>
  )
}
