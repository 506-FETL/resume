import * as React from 'react'
import { useResponsiveDialogContext } from '../context'
import { DrawerFooter, DrawerClose } from '@/components/ui/drawer'
import { cn } from '@/lib/utils'

export function ResponsiveDialogFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const { isMobile } = useResponsiveDialogContext()

  if (isMobile) {
    return (
      <DrawerFooter className={className} {...props}>
        {children}
        <DrawerClose render={<button className='hidden' />} />
      </DrawerFooter>
    )
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-end gap-3 border-t border-border/40 bg-muted/20 px-6 py-4 sm:flex-row',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
