import type { FieldRendererProps } from './types'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { isEmptyValue } from '@/pages/optimize/utils'
import { EmptyValue } from './types'

export function StringArrayValue({ value, variant }: FieldRendererProps<string[]>) {
  if (isEmptyValue(value))
    return <EmptyValue />

  return (
    <div className="flex flex-wrap gap-1">
      {value.map(item => (
        <Badge
          key={`tag-${item}`}
          variant="secondary"
          className={cn(
            'text-[10px] px-1.5 py-0.5',
            variant === 'before' && 'bg-muted/50 text-muted-foreground',
            variant === 'after' && 'bg-primary/10 text-primary',
          )}
        >
          {item}
        </Badge>
      ))}
    </div>
  )
}
