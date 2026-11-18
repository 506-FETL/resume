import type * as React from 'react'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { cn } from '@/lib/utils'
import { SIDEBAR_WIDTH_MOBILE, useSidebar } from '../sidebar-context'
import type { MobileSidebarProps } from './types'

export default function MobileSidebar({
  side,
  className,
  children,
  ...props
}: MobileSidebarProps) {
  const { openMobile, setOpenMobile, mobileTriggerRef } = useSidebar()

  return (
    <Drawer
      open={openMobile}
      onOpenChange={setOpenMobile}
      swipeDirection={side}
    >
      <DrawerContent
        {...props}
        finalFocus={mobileTriggerRef}
        data-sidebar='sidebar'
        data-mobile='true'
        className={cn(
          'bg-sidebar text-sidebar-foreground overflow-hidden p-0',
          className,
        )}
        style={
          {
            ...props.style,
            '--sidebar-width': SIDEBAR_WIDTH_MOBILE,
            '--drawer-content-height': 'calc(100dvh - 1rem)',
            '--drawer-content-width': SIDEBAR_WIDTH_MOBILE,
          } as React.CSSProperties
        }
      >
        <DrawerHeader className='sr-only'>
          <DrawerTitle>主导航</DrawerTitle>
          <DrawerDescription>
            选择要打开的页面，按 Escape 关闭导航。
          </DrawerDescription>
        </DrawerHeader>
        <div className='flex min-h-0 w-full flex-1 flex-col overflow-hidden'>
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
