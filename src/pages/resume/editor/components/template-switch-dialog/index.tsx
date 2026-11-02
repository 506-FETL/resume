import type { RefObject } from 'react'
import { createDeferredComponent } from '@/components/deferred-content'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION, EASE } from '@/lib/motion'
import useResumeStore from '@/store/resume/form'
import { useTemplateCatalogEntry } from '../../hooks/use-template-catalog-entry'
import { useTemplateSwitchStore } from '../../template-switch/store'

const DialogBody = createDeferredComponent(
  () => import('./components/dialog-body'),
  '模板选择',
)

export default function TemplateSwitchDialog({
  triggerRef,
}: {
  triggerRef: RefObject<HTMLButtonElement | null>
}) {
  const open = useTemplateSwitchStore((state) => state.open)
  const close = useTemplateSwitchStore((state) => state.closeDialog)
  const reduceMotion = useReducedMotion()

  const templateId = useResumeStore(
    (state) => state.templateBinding?.templateId,
  )

  const current = useTemplateCatalogEntry(templateId)

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent
        className='flex h-[94dvh] max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 md:h-[90dvh] md:max-w-[min(1400px,calc(100%-4rem))]'
        style={{
          animationDuration: `${reduceMotion ? 0 : open ? DURATION.base : DURATION.fast}s`,
          animationTimingFunction: `cubic-bezier(${(open ? EASE.out : EASE.in).join(',')})`,
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          triggerRef.current?.focus()
        }}
      >
        <DialogHeader className='shrink-0 border-b p-5 pr-14 md:px-6'>
          <DialogTitle className='text-lg'>更换模板</DialogTitle>
          <DialogDescription>
            当前使用：
            {current.item?.name ?? '当前模板'}
            。预览当前简历，应用后生效。
          </DialogDescription>
        </DialogHeader>
        <DialogBody />
      </DialogContent>
    </Dialog>
  )
}
