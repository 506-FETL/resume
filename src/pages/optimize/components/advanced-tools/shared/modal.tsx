import type { PropsWithChildren, ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { useIsMobile } from '@/hooks/use-mobile'

interface AdvancedToolsModalProps extends PropsWithChildren {
  description: string
  footer?: ReactNode
  meta?: ReactNode
  onOpenChange: (open: boolean) => void
  open: boolean
  title: string
}

function ModalBody({ children }: PropsWithChildren) {
  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-4 md:px-6 md:py-5">
      {children}
    </div>
  )
}

export function AdvancedToolsModal({
  children,
  description,
  footer,
  meta,
  onOpenChange,
  open,
  title,
}: AdvancedToolsModalProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle>
        <DrawerContent
          className="h-[92dvh]"
          overlayClassName="supports-backdrop-filter:backdrop-blur-none"
        >
          <DrawerHeader className="border-b border-border/60 pb-4 text-left">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <DrawerTitle>{title}</DrawerTitle>
                <DrawerDescription className="wrap-break-word text-left leading-5">
                  {description}
                </DrawerDescription>
              </div>
              <DrawerClose
                render={<Button variant="ghost" size="icon-sm" aria-label="关闭" />}
              >
                <X className="size-4" />
              </DrawerClose>
            </div>
            {meta && <div className="flex flex-wrap gap-2 pt-2 text-left">{meta}</div>}
          </DrawerHeader>

          <ModalBody>{children}</ModalBody>
          {footer}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[min(90dvh,60rem)] min-h-0 w-[min(90rem,calc(100vw-4rem))] max-w-none flex-col gap-0 overflow-hidden p-0"
        showCloseButton={false}
      >
        <DialogHeader className="shrink-0 border-b border-border/60 p-5 text-left md:px-6">
          <div className="flex min-w-0 items-start justify-between gap-4">
            <div className="min-w-0 space-y-1.5">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription className="wrap-break-word text-left leading-6">
                {description}
              </DialogDescription>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={() => onOpenChange(false)} aria-label="关闭">
              <X className="size-4" />
            </Button>
          </div>
          {meta && <div className="flex flex-wrap gap-2 pt-1 text-left">{meta}</div>}
        </DialogHeader>

        <ModalBody>{children}</ModalBody>
        {footer}
      </DialogContent>
    </Dialog>
  )
}
