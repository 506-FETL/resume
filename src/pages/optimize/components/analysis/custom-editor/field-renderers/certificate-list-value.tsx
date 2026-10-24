import type { FieldRendererProps } from './types'
import { Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { isEmptyValue } from '@/pages/optimize/utils'
import { EmptyValue } from './types'

export function CertificateListValue({
  value,
  variant,
}: FieldRendererProps<Array<{ name: string }>>) {
  if (isEmptyValue(value)) return <EmptyValue />

  return (
    <div className='flex flex-wrap gap-1'>
      {value.map((cert) => (
        <Badge
          key={`cert-${cert.name}`}
          variant='outline'
          className={cn(
            'text-[10px] px-1.5 py-0.5 gap-1',
            variant === 'before' && 'border-border/50 text-muted-foreground',
            variant === 'after' &&
              'border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400',
          )}
        >
          <Star className='size-2.5' />
          {cert.name}
        </Badge>
      ))}
    </div>
  )
}
