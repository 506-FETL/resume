import type { CSSProperties, ReactNode } from 'react'
import { useRef } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerVirtualKeyboardProvider,
} from '@/components/ui/drawer'

interface ShareDrawerProps {
  open: boolean
  busy?: boolean
  title: ReactNode
  description: string
  children: ReactNode
  footer: ReactNode
  onOpenChange: (open: boolean) => void
  onOpenChangeComplete?: (open: boolean) => void
}

export default function ShareDrawer({
  open,
  busy = false,
  title,
  description,
  children,
  footer,
  onOpenChange,
  onOpenChangeComplete,
}: ShareDrawerProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  return (
    <Drawer
      open={open}
      swipeDirection='right'
      onOpenChangeComplete={onOpenChangeComplete}
      onOpenChange={(nextOpen, details) => {
        // Radix 浮层不在 Base UI 的浮层树中，Escape 只关闭当前层。
        const nestedEscape =
          details.reason === 'escape-key' &&
          details.event
            .composedPath()
            .some(
              (node) =>
                node instanceof Element &&
                node.matches(
                  '[data-slot="dialog-content"], [role="alertdialog"], [role="listbox"], [role="menu"], [data-slot="popover-content"]',
                ),
            )

        if (!nextOpen && (busy || nestedEscape)) {
          details.cancel()

          return
        }

        onOpenChange(nextOpen)
      }}
    >
      <DrawerVirtualKeyboardProvider>
        <DrawerContent
          initialFocus={() => {
            const activeElement = document.activeElement

            if (
              activeElement instanceof HTMLElement &&
              activeElement !== document.body &&
              !activeElement.closest('[data-slot="drawer-popup"]')
            ) {
              returnFocusRef.current = activeElement
            }

            return closeButtonRef.current
          }}
          finalFocus={() =>
            returnFocusRef.current?.isConnected ? returnFocusRef.current : true
          }
          className='min-w-0 overflow-clip p-0'
          style={
            {
              '--drawer-content-height': '100%',
              '--drawer-content-width': 'min(45rem, calc(100vw - 1rem))',
            } as CSSProperties
          }
        >
          <DrawerHeader className='gap-1 border-b px-4 py-4 text-left sm:px-6'>
            <div className='flex min-w-0 items-start justify-between gap-3'>
              <DrawerTitle className='line-clamp-2 min-w-0 pt-1 text-lg leading-6 font-semibold break-words'>
                {title}
              </DrawerTitle>
              <Button
                ref={closeButtonRef}
                type='button'
                variant='ghost'
                size='icon-sm'
                className='shrink-0'
                aria-label='关闭分享面板'
                data-share-dialog-fallback=''
                disabled={busy}
                onClick={() => onOpenChange(false)}
              >
                <X />
              </Button>
            </div>
            <DrawerDescription className='text-xs leading-5'>
              {description}
            </DrawerDescription>
          </DrawerHeader>
          <div className='scrollbar-thin-subtle min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6'>
            {children}
          </div>
          <DrawerFooter className='flex-row items-center justify-end border-t px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] sm:px-6'>
            {footer}
          </DrawerFooter>
        </DrawerContent>
      </DrawerVirtualKeyboardProvider>
    </Drawer>
  )
}
