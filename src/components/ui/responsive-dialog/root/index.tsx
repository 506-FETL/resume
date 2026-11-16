import type { ResponsiveDialogProps } from '../types'
import { useIsMobile } from '@/hooks/use-mobile'
import * as React from 'react'
import { ResponsiveDialogContext } from '../context'
import { Drawer, DrawerTrigger, DrawerContent } from '@/components/ui/drawer'
import { Dialog, DialogTrigger, DialogContent } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export function ResponsiveDialog({
  children,
  trigger,
  open,
  onOpenChange,
  variant = 'default',
  errors,
  contentClassName,
  overlayClassName,
}: ResponsiveDialogProps) {
  const isMobile = useIsMobile()
  const [activeSection, setActiveSection] = React.useState('')

  const contextValue = React.useMemo(
    () => ({
      activeSection,
      setActiveSection,
      isMobile,
      variant,
      errors,
    }),
    [activeSection, errors, isMobile, variant],
  )

  if (isMobile) {
    return (
      <ResponsiveDialogContext.Provider value={contextValue}>
        <Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle>
          {trigger && <DrawerTrigger render={trigger} />}
          <DrawerContent
            className={contentClassName}
            overlayClassName={overlayClassName}
          >
            {children}
          </DrawerContent>
        </Drawer>
      </ResponsiveDialogContext.Provider>
    )
  }

  return (
    <ResponsiveDialogContext.Provider value={contextValue}>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
        <DialogContent
          className={cn(
            'flex flex-col overflow-hidden p-0 duration-200',
            variant === 'sidebar'
              ? 'h-[min(90vh,880px)] w-[calc(85vw)] sm:max-w-[min(1000px,calc(100vw-2rem))] lg:max-w-[min(1120px,85vw)]'
              : 'max-h-[85vh] sm:max-w-lg',
            contentClassName,
          )}
          overlayClassName={overlayClassName}
        >
          {children}
        </DialogContent>
      </Dialog>
    </ResponsiveDialogContext.Provider>
  )
}
