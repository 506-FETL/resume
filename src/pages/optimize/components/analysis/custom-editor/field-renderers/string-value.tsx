import type { FieldRendererProps } from './types'
import { cn } from '@/lib/utils'
import { isEmptyValue } from '@/pages/optimize/utils'
import { EmptyValue } from './types'

export function StringValue({ value, variant }: FieldRendererProps<string>) {
  if (isEmptyValue(value)) return <EmptyValue />

  return (
    <span
      className={cn(
        'wrap-break-word whitespace-pre-wrap text-sm',
        variant === 'before' &&
          'text-muted-foreground line-through decoration-destructive/50 dark:decoration-red-400/50',
        variant === 'after' && 'text-foreground font-medium',
      )}
    >
      {value}
    </span>
  )
}
