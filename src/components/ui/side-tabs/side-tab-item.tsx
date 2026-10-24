'use client'

import type { PropsWithChildren } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { Button } from '@/components/ui/button'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { useSideTabsContext } from './side-tabs-provider'

function callAll(...fns: Array<(() => void) | undefined>) {
  return () => {
    fns.forEach((fn) => fn && fn())
  }
}

export function Tab({
  asChild = false,
  onClick,
  id,
  className,
  ...props
}: PropsWithChildren<{
  asChild?: boolean
  onClick?: () => void
  id: string
  className?: string
  disabled?: boolean
}>) {
  const { setActive, recomputeGeometry, active, btnRefs } = useSideTabsContext()
  const isMobile = useIsMobile()
  const Comp = asChild ? Slot : Button

  return (
    <Comp
      key={id}
      size={isMobile ? 'icon' : 'sm'}
      ref={(el) => {
        btnRefs.current[id] = el
      }}
      variant={active === id ? 'default' : 'secondary'}
      className={cn(
        'justify-center transition-all duration-200 ease-in-out shrink-0',
        className,
      )}
      onClick={callAll(() => {
        setActive(id)
        requestAnimationFrame(recomputeGeometry)
      }, onClick)}
      {...props}
    />
  )
}
