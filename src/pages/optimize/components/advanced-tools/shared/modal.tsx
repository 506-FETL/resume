import type { PropsWithChildren, ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { useIsMobile } from '@/hooks/use-mobile'

interface AdvancedToolsModalProps extends PropsWithChildren {
  description: ReactNode
  footer?: ReactNode
  onOpenChange: (open: boolean) => void
  open: boolean
  title: string
}

function ModalShell({ children, closeButton, description, footer, title }: {
  children: ReactNode
  closeButton: ReactNode
  description: ReactNode
  footer?: ReactNode
  title: string
}) {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="shrink-0 border-b border-border/60 px-5 py-4 md:px-6 md:py-5 lg:px-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="text-lg font-semibold tracking-tight">{title}</div>
            <div className="wrap-break-word text-sm leading-6 text-muted-foreground">{description}</div>
          </div>
          {closeButton}
        </div>
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <div className="h-full min-w-0 overflow-x-hidden overflow-y-auto px-5 py-5 md:px-6 md:py-5 lg:px-8 lg:py-6">
          {children}
        </div>
      </div>

      {footer}
    </div>
  )
}

export function AdvancedToolsModal({
  children,
  description,
  footer,
  onOpenChange,
  open,
  title,
}: AdvancedToolsModalProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle>
        <DrawerContent className="flex h-[92vh] min-w-0 flex-col overflow-hidden border-border/70 bg-background/95 p-0 backdrop-blur">
          <DrawerHeader className="sr-only">
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>{typeof description === 'string' ? description : '高级工具箱弹窗'}</DrawerDescription>
          </DrawerHeader>
          <ModalShell
            closeButton={(
              <DrawerClose
                render={<Button variant="ghost" size="icon-sm" aria-label="关闭" />}
              >
                <X className="size-4" />
              </DrawerClose>
            )}
            description={description}
            footer={footer}
            title={title}
          >
            {children}
          </ModalShell>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[min(90vh,920px)] w-[calc(70vw)] min-w-0 max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden border-border/70 bg-background/95 p-0 shadow-xl backdrop-blur sm:max-w-[min(1320px,calc(70vw))] lg:max-w-[min(1480px,calc(70vw))]"
        showCloseButton={false}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{typeof description === 'string' ? description : '高级工具箱弹窗'}</DialogDescription>
        </DialogHeader>
        <ModalShell
          closeButton={(
            <Button variant="ghost" size="icon-sm" onClick={() => onOpenChange(false)} aria-label="关闭">
              <X className="size-4" />
            </Button>
          )}
          description={description}
          footer={footer}
          title={title}
        >
          {children}
        </ModalShell>
      </DialogContent>
    </Dialog>
  )
}
