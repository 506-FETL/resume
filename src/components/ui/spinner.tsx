import type { ComponentProps } from 'react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { cn } from '@/lib/utils'
import './spinner.css'

function Spinner({ className, ...props }: ComponentProps<'svg'>) {
  const reduceMotion = useReducedMotion()

  return (
    <svg
      data-slot='spinner'
      data-reduced-motion={reduceMotion}
      role='status'
      aria-label='加载中'
      viewBox='0 0 500 500'
      xmlns='http://www.w3.org/2000/svg'
      className={cn('inline-block size-4 shrink-0 align-middle', className)}
      {...props}
    >
      <circle
        className='loading-ui-swirling-circle'
        cx='250'
        cy='250'
        r='200'
        fill='none'
        stroke='currentColor'
        strokeLinecap='round'
        strokeWidth='50'
      />
    </svg>
  )
}

export { Spinner }
