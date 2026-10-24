'use client'

import type { PropsWithChildren } from 'react'
import { cn } from '@/lib/utils'
import { useSideTabsContext } from './side-tabs-provider'

export function SideTabs({
  orientation = 'vertical',
  className,
  ...props
}: PropsWithChildren<{
  orientation?: 'horizontal' | 'vertical'
  className?: string
}>) {
  const { tabsRef } = useSideTabsContext()

  return (
    <div
      ref={tabsRef}
      className={cn(
        'flex gap-3',
        orientation === 'horizontal'
          ? 'flex-col pr-4'
          : 'flex-row overflow-x-auto pb-4',
        className,
      )}
      style={
        orientation === 'vertical' ? { scrollbarWidth: 'thin' } : undefined
      }
      {...props}
    />
  )
}
