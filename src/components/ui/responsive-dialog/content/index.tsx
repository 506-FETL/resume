import * as React from 'react'
import { useResponsiveDialogContext } from '../context'
import { cn } from '@/lib/utils'

export function ResponsiveDialogContent({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const { variant } = useResponsiveDialogContext()

  return (
    <div
      className={cn(
        'flex flex-1 min-h-0',
        variant === 'sidebar' ? 'flex-row' : 'flex-col',
        className,
      )}
    >
      {children}
    </div>
  )
}
