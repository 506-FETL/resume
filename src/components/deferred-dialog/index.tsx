import type { ComponentType, ReactNode } from 'react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { restoreDialogFocus } from '@/lib/dialog-focus'
import { FormSkeleton } from '@/components/loading-skeleton'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function deferDialog<Props extends object>(
  load: () => Promise<{ default: ComponentType<Props> }>,
  title: string,
) {
  return function DeferredDialog({
    open,
    onClose,
    children,
    loadingTitle = title,
  }: {
    loadingTitle?: string
    open: boolean
    onClose: () => void
    children: (
      Content: ComponentType<Props>,
      opener: HTMLElement | null,
    ) => ReactNode
  }) {
    const [opened, setOpened] = useState(false)
    const [Content, setContent] = useState(() => lazy(load))

    const triggerRef = useRef<HTMLElement | null>(null)
    const openRef = useRef(false)

    if (open && !openRef.current) {
      const active = document.activeElement

      triggerRef.current =
        active instanceof HTMLElement && active !== document.body
          ? active
          : null
    }

    openRef.current = open

    useEffect(() => {
      if (open) setOpened(true)
    }, [open])

    if (!open && !opened) return null

    function feedback(retry?: () => void) {
      return (
        <Dialog
          open={open}
          onOpenChange={(next) => {
            if (!next) onClose()
          }}
        >
          <DialogContent
            onCloseAutoFocus={(event) => {
              // 卸载回调可能晚于 Escape，只有弹窗仍打开时才由真实内容接管焦点。
              if (openRef.current) event.preventDefault()
              else restoreDialogFocus(event, triggerRef.current)
            }}
          >
            <DialogHeader>
              <DialogTitle>{loadingTitle}</DialogTitle>
              <DialogDescription>
                {retry ? '暂时无法打开，请重试。' : '正在加载…'}
              </DialogDescription>
            </DialogHeader>
            {retry ? (
              <Button variant='outline' onClick={retry}>
                重试
              </Button>
            ) : (
              <FormSkeleton label={`正在加载${loadingTitle}`} />
            )}
          </DialogContent>
        </Dialog>
      )
    }

    return (
      <ErrorBoundary
        onReset={() => setContent(() => lazy(load))}
        fallbackRender={({ resetErrorBoundary }) =>
          feedback(resetErrorBoundary)
        }
      >
        <Suspense fallback={feedback()}>
          {children(Content as ComponentType<Props>, triggerRef.current)}
        </Suspense>
      </ErrorBoundary>
    )
  }
}
