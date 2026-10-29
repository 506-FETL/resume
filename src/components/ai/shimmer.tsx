import type { CSSProperties, ElementType } from 'react'
import { memo } from 'react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { cn } from '@/lib/utils'
import './shimmer.css'

export interface TextShimmerProps {
  children: string
  as?: ElementType
  className?: string
  duration?: number
  spread?: number
}

function ShimmerComponent({
  children,
  as: Component = 'span',
  className,
  duration = 2,
  spread = 2,
}: TextShimmerProps) {
  const reduceMotion = useReducedMotion()

  return (
    <Component
      className={cn(
        'ai-shimmer relative inline-block text-muted-foreground',
        className,
      )}
      style={
        {
          '--ai-shimmer-duration': `${duration}s`,
          '--ai-shimmer-spread': `${children.length * spread}px`,
        } as CSSProperties
      }
    >
      {children}
      {!reduceMotion && (
        <span aria-hidden='true' className='ai-shimmer-highlight'>
          {children}
        </span>
      )}
    </Component>
  )
}

export const Shimmer = memo(ShimmerComponent)
