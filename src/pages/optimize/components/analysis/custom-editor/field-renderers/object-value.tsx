import type { FieldRendererProps } from './types'
import { cn } from '@/lib/utils'
import { getFieldLabel, isEmptyValue, renderValue } from '@/pages/optimize/utils'
import { EmptyValue } from './types'

export function ObjectValue({ value, variant }: FieldRendererProps<Record<string, unknown>>) {
  if (isEmptyValue(value))
    return <EmptyValue />

  const entries = Object.entries(value).filter(([_, v]) => !isEmptyValue(v))

  if (entries.length === 0)
    return <EmptyValue />

  return (
    <div className={cn(
      'flex flex-col gap-1.5 p-2 rounded-md border text-xs',
      variant === 'before' && 'bg-muted/30 border-border/50',
      variant === 'after' && 'bg-primary/5 border-primary/20',
    )}
    >
      {entries.map(([key, val]) => (
        <div key={key} className="flex items-start gap-2">
          <span className="text-muted-foreground shrink-0 min-w-16">
            {getFieldLabel(key)}
            :
          </span>
          <span className={cn(
            'min-w-0 flex-1 wrap-break-word whitespace-pre-wrap',
            variant === 'after' && 'text-foreground font-medium',
          )}
          >
            {renderValue(val)}
          </span>
        </div>
      ))}
    </div>
  )
}
