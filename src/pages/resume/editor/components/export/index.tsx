import type { ReactNode } from 'react'
import type { CheckFilter } from '../../store/checks'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { createDeferredComponent } from '@/components/deferred-content'
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
import useUserStore from '@/store/user'
import { useResumeCheckStore } from '../../store/checks'

interface ExportDialogProps {
  trigger: ReactNode
}

const ExportContent = createDeferredComponent(
  () => import('./components/dialog-content'),
  '导出选项',
)

export default function ExportDialog({ trigger }: ExportDialogProps) {
  const initialized = useResumeStore((state) => state.isInitialized)
  const resumeId = useResumeStore((state) => state.currentResumeId)
  const name = useResumeStore((state) => state.basics.name)
  const ownerId = useUserStore((state) => state.currentUser?.id ?? null)
  const [open, setOpen] = useState(false)
  const [contentMounted, setContentMounted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [clickFailure, setClickFailure] = useState<string | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  const pendingCheckRef = useRef<{
    filter: CheckFilter
    issueId?: string
  } | null>(null)

  const reducedMotion = useReducedMotion()
  const identity = `${ownerId ?? 'guest'}:${resumeId}`

  useEffect(() => {
    if (searchParams.get('check') !== '1' || !initialized) return

    setOpen(true)

    const next = new URLSearchParams(searchParams)

    next.delete('check')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams, initialized])

  const changeOpen = (next: boolean) => {
    if (next) {
      pendingCheckRef.current = null
      setClickFailure(null)
    }

    setOpen(next)
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        onOpenAutoFocus={() => setContentMounted(true)}
        style={{
          animationDuration: `${reducedMotion ? 0 : open ? DURATION.base : DURATION.fast}s`,
          animationTimingFunction: `cubic-bezier(${(open ? EASE.out : EASE.in).join(',')})`,
        }}
        className='flex max-h-[85dvh] flex-col gap-4 sm:max-w-lg'
        overlayClassName='resume-export-overlay'
        onCloseAutoFocus={() => {
          // 保留退出中的正文，实际卸载后再处理检查跳转。
          setContentMounted(false)

          const pendingCheck = pendingCheckRef.current

          pendingCheckRef.current = null

          if (pendingCheck) {
            requestAnimationFrame(() => {
              const current = useResumeStore.getState()

              const currentOwner =
                useUserStore.getState().currentUser?.id ?? null

              if (
                `${currentOwner ?? 'guest'}:${current.currentResumeId}` !==
                identity
              )
                return

              useResumeCheckStore
                .getState()
                .requestChecks(pendingCheck.filter, pendingCheck.issueId)
            })
          }
        }}
      >
        <style>{`.resume-export-overlay[data-state="open"]{animation-duration:${reducedMotion ? 0 : DURATION.base}s;animation-timing-function:cubic-bezier(${EASE.out.join(',')})}.resume-export-overlay[data-state="closed"]{animation-duration:${reducedMotion ? 0 : DURATION.fast}s;animation-timing-function:cubic-bezier(${EASE.in.join(',')})}`}</style>
        <DialogHeader className='shrink-0'>
          <DialogTitle>导出简历</DialogTitle>
          <DialogDescription className='sr-only'>
            查看当前简历的检查摘要，选择 PDF 或 Word 导出。
          </DialogDescription>
          <p className='truncate pr-6 text-sm text-muted-foreground'>
            {name ? `${name}的简历` : '当前简历'}
          </p>
        </DialogHeader>
        <ExportContent
          open={open}
          enabled={open || contentMounted}
          busy={busy}
          setBusy={setBusy}
          clickFailure={clickFailure}
          setClickFailure={setClickFailure}
          setOpen={setOpen}
          viewChecks={(filter, issueId) => {
            pendingCheckRef.current = { filter, issueId }
            setOpen(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
