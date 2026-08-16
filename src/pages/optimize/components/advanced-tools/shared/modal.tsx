import type { PropsWithChildren, ReactNode } from 'react'
import { X } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { useIsMobile } from '@/hooks/use-mobile'

const MODAL_HIDDEN = { opacity: 0, scale: 0.97, y: 12 }
const MODAL_VISIBLE = { opacity: 1, scale: 1, y: 0 }
const MODAL_ENTER_TRANSITION = { duration: 0.2, ease: [0.16, 1, 0.3, 1] as const }
const MODAL_EXIT_TRANSITION = { duration: 0.14, ease: [0.4, 0, 1, 1] as const }

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
  const shouldReduceMotion = useReducedMotion()

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle>
        <DrawerContent overlayClassName="supports-backdrop-filter:backdrop-blur-none">
          <DrawerHeader className="border-b border-border/60 pb-4 text-left">
            <div className="min-w-0">
              <div className="min-w-0 space-y-1">
                <DrawerTitle>{title}</DrawerTitle>
                <DrawerDescription className="wrap-break-word text-left leading-5">
                  {description}
                </DrawerDescription>
              </div>
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
        className="h-[80vh] w-[60vw] gap-0 rounded-none bg-transparent p-0 ring-0 sm:max-w-[min(90rem,calc(100vw-4rem))] data-[state=open]:!animate-none data-[state=closed]:!animate-[advanced-tools-modal-presence_150ms_linear] motion-reduce:data-[state=closed]:!animate-none"
        showCloseButton={false}
      >
        <motion.div
          initial={shouldReduceMotion ? false : MODAL_HIDDEN}
          animate={open || shouldReduceMotion ? MODAL_VISIBLE : MODAL_HIDDEN}
          transition={shouldReduceMotion
            ? { duration: 0 }
            : open ? MODAL_ENTER_TRANSITION : MODAL_EXIT_TRANSITION}
          className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl bg-popover text-sm text-popover-foreground ring-1 ring-foreground/10"
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
        </motion.div>
      </DialogContent>
    </Dialog>
  )
}
