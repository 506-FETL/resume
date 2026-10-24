import type { FieldRendererProps } from './types'
import { Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isEmptyValue } from '@/pages/optimize/utils'
import { EmptyValue } from './types'

export function DateRangeValue({
  value,
  variant,
}: FieldRendererProps<string[]>) {
  if (isEmptyValue(value)) return <EmptyValue />

  const [start, end] = value
  const hasStart = !isEmptyValue(start)
  const hasEnd = !isEmptyValue(end)

  if (!hasStart && !hasEnd) return <EmptyValue />

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 text-xs',
        variant === 'before' && 'text-muted-foreground',
        variant === 'after' && 'text-foreground',
      )}
    >
      <Calendar className='size-3 shrink-0 opacity-60' />
      <span>{hasStart ? start : '未填'}</span>
      <span className='text-muted-foreground'>至</span>
      <span>{hasEnd ? end : '至今'}</span>
    </div>
  )
}
