import type { ResumeProfile } from '@/lib/resume-preparation/types'
import type { ORDERType } from '@/lib/schema'
import { Lightbulb } from 'lucide-react'
import { useRef, useState } from 'react'
import { createDeferredComponent } from '@/components/deferred-content'
import { FormSkeleton } from '@/components/loading-skeleton'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION, EASE } from '@/lib/motion'
import useResumeStore from '@/store/resume/form'
import { useResumeReviewStore } from '../../review-store'
import { usePreparationUiStore } from '../../preparation-store'

const PreparationContent = createDeferredComponent(
  () => import('./components/dialog-content'),
  '填写建议',
  <FormSkeleton label='正在加载填写建议' />,
)

export default function Preparation({
  isMobile = false,
}: {
  isMobile?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [contentMounted, setContentMounted] = useState(false)
  const [selected, setSelected] = useState<ResumeProfile | null>(null)
  const [busy, setBusy] = useState(false)

  const pendingEditRef = useRef<{
    resumeId: string
    section: ORDERType
  } | null>(null)

  const initialized = useResumeStore((state) => state.isInitialized)
  const reviewActive = useResumeReviewStore((state) => state.active)
  const reducedMotion = useReducedMotion()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant='outline'
          size={isMobile ? 'icon' : 'sm'}
          aria-label='填写建议'
          title='填写建议'
          disabled={!initialized || reviewActive}
        >
          <Lightbulb />
          {!isMobile && <span>填写建议</span>}
        </Button>
      </DialogTrigger>
      <DialogContent
        onOpenAutoFocus={() => setContentMounted(true)}
        onCloseAutoFocus={() => {
          setContentMounted(false)

          const request = pendingEditRef.current

          pendingEditRef.current = null

          if (request)
            requestAnimationFrame(() => {
              if (
                useResumeStore.getState().currentResumeId === request.resumeId
              )
                usePreparationUiStore
                  .getState()
                  .requestEdit(request.resumeId, request.section)
            })
        }}
        style={{
          animationDuration: `${reducedMotion ? 0 : open ? DURATION.base : DURATION.fast}s`,
          animationTimingFunction: `cubic-bezier(${(open ? EASE.out : EASE.in).join(',')})`,
        }}
        className='max-h-[85dvh] overflow-y-auto sm:max-w-lg'
        overlayClassName='preparation-dialog-overlay'
      >
        <style>{`.preparation-dialog-overlay[data-state="open"]{animation-duration:${reducedMotion ? 0 : DURATION.base}s;animation-timing-function:cubic-bezier(${EASE.out.join(',')})}.preparation-dialog-overlay[data-state="closed"]{animation-duration:${reducedMotion ? 0 : DURATION.fast}s;animation-timing-function:cubic-bezier(${EASE.in.join(',')})}`}</style>
        <DialogHeader>
          <DialogTitle>填写建议</DialogTitle>
          <DialogDescription className='sr-only'>
            按求职阶段查看写法和参考示例。
          </DialogDescription>
        </DialogHeader>
        <PreparationContent
          open={open}
          enabled={open || contentMounted}
          selected={selected}
          setSelected={setSelected}
          busy={busy}
          setBusy={setBusy}
          onEdit={(request) => {
            pendingEditRef.current = request
            setOpen(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
