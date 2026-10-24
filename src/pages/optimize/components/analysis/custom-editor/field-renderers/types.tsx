import { cn } from '@/lib/utils'

export type RendererVariant = 'before' | 'after'

export interface FieldRendererProps<T = unknown> {
  value: T
  variant?: RendererVariant
}

export function EmptyValue() {
  return <span className='text-muted-foreground/50 italic text-xs'>空</span>
}

export function variantText(variant?: RendererVariant) {
  return cn(
    variant === 'before' && 'text-muted-foreground',
    variant === 'after' && 'text-foreground',
  )
}
