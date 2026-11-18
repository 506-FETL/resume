import { createDeferredComponent } from '@/components/deferred-content'
import { FormSkeleton } from '@/components/loading-skeleton'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION, EASE } from '@/lib/motion'
import { Plus, X } from 'lucide-react'
import type { ReactNode, RefObject } from 'react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import useMeasure from 'react-use-measure'
import { useCreationDraftStore } from './store'

const CreationContent = createDeferredComponent(
  () => import('./components/creation-content'),
  '创建简历',
  <div className='flex w-[min(600px,calc(100vw-2rem))] flex-col gap-4 p-5'>
    <h2 className='pr-8 text-lg font-medium'>创建简历</h2>
    <FormSkeleton
      label='正在加载创建选项'
      className='min-h-[min(16rem,60dvh)] px-0'
    />
  </div>,
  { wrapFallback: false },
)

export default function CreateResumeCard({
  trigger,
  online,
  onCreated,
  open,
  onOpenChange,
  hideTrigger,
  returnFocusRef,
}: {
  trigger?: ReactNode
  online?: boolean
  onCreated?: () => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
  returnFocusRef?: RefObject<HTMLElement | null>
}) {
  const reduceMotion = useReducedMotion()
  const [measureRef, bounds, refreshBounds] = useMeasure({ offsetSize: true })
  const [localOpen, setLocalOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const isOpen = open ?? localOpen
  const setIsOpen = onOpenChange ?? setLocalOpen
  const panelHostRef = useRef<HTMLDivElement | null>(null)
  const cancelReadRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      const state = useCreationDraftStore.getState()

      if (state.draft.sourceText && (state.saving || state.saveError))
        event.preventDefault()
    }

    window.addEventListener('beforeunload', beforeUnload)

    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [])

  useLayoutEffect(() => {
    if (!reduceMotion) return

    const dialog = panelHostRef.current?.parentElement
    const overlay = dialog?.previousElementSibling

    dialog?.getAnimations().forEach((animation) => animation.finish())

    if (overlay?.matches('[data-slot="dialog-overlay"]'))
      overlay.getAnimations().forEach((animation) => animation.finish())
  }, [isOpen, reduceMotion])

  function close(next: boolean) {
    if (creating) return
    if (!next) cancelReadRef.current?.()

    setIsOpen(next)
  }

  return (
    <Dialog open={isOpen} onOpenChange={close}>
      {!hideTrigger &&
        (trigger ? (
          <DialogTrigger asChild>{trigger}</DialogTrigger>
        ) : (
          <DialogTrigger asChild>
            <Button
              variant='outline'
              type='button'
              className='h-full min-h-48 w-full flex-col gap-3 rounded-xl border-2 border-dashed bg-card p-6 transition-colors hover:border-primary/50 hover:bg-accent/40 motion-reduce:transition-none'
            >
              <Plus className='size-6' />
              创建新简历
            </Button>
          </DialogTrigger>
        ))}
      <DialogContent
        showCloseButton={false}
        className='block overflow-hidden p-0 transition-[width,height] sm:max-w-none'
        style={{
          width: bounds.width || 'min(600px, calc(100vw - 2rem))',
          height: bounds.height || undefined,
          transitionDuration: `${reduceMotion ? 0 : DURATION.slow}s`,
          transitionTimingFunction: `cubic-bezier(${EASE.out.join(',')})`,
          animationDuration: `${reduceMotion ? 0 : DURATION.base}s`,
        }}
        onInteractOutside={(event) => {
          if (creating) event.preventDefault()
        }}
        onEscapeKeyDown={(event) => {
          if (creating) event.preventDefault()
        }}
        onCloseAutoFocus={(event) => {
          const target = returnFocusRef?.current

          if (target?.isConnected) {
            event.preventDefault()
            target.focus()
          }
        }}
      >
        <DialogTitle className='sr-only'>创建简历</DialogTitle>
        <DialogDescription className='sr-only'>
          选择创建方式，准备简历内容并选择模板。
        </DialogDescription>
        <div ref={panelHostRef} tabIndex={-1} className='outline-none'>
          <CreationContent
            isOpen={isOpen}
            setIsOpen={setIsOpen}
            online={online}
            onCreated={onCreated}
            creating={creating}
            setCreating={setCreating}
            panelHostRef={panelHostRef}
            cancelReadRef={cancelReadRef}
            measureRef={measureRef}
            refreshBounds={refreshBounds}
          />
        </div>
        <Button
          variant='ghost'
          size='icon-sm'
          className='absolute top-4 right-4'
          disabled={creating}
          onClick={() => close(false)}
          aria-label='关闭创建简历'
        >
          <X />
        </Button>
      </DialogContent>
    </Dialog>
  )
}
