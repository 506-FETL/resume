import type { ComponentProps, ReactElement } from 'react'
import type { Severity } from '@/pages/optimize/types'
import { Wand2 } from 'lucide-react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import { Spinner } from '@/components/ui/spinner'
import { useIsMobile } from '@/hooks/use-mobile'
import { hasUnresolvedSuggestionInput } from '@/lib/ats'
import { cn } from '@/lib/utils'
import { severityConfig } from '@/pages/optimize/const'
import useAtsStore from '@/pages/optimize/store'
import { getErrorMessage } from '@/utils/error'
import { createDeferredComponent } from '@/components/deferred-content'

const Content = createDeferredComponent<
  ComponentProps<typeof import('./content').default>
>(() => import('./content'), '修复详情')

interface IssueFixProps {
  children: ReactElement
  id: string
  severity: Severity
}

function IssueFix({ id, severity, children }: IssueFixProps) {
  const config = severityConfig[severity]
  const [open, setOpen] = useState(false)
  const [contentReady, setContentReady] = useState(false)
  const [isFixing, setIsFixing] = useState(false)
  const isMobile = useIsMobile()
  const reduceMotion = useReducedMotion()
  const update = useAtsStore((s) => s.update)

  const finding = useAtsStore((s) =>
    s.currentAtsConfig?.findings[severity].find((item) => item.id === id),
  )

  const triggerRef = useRef<HTMLButtonElement | null>(null)

  const allFixed = finding?.fix.suggestions?.length
    ? finding.fix.suggestions.every((s) => s.fixed)
    : false

  const needsUserInput = hasUnresolvedSuggestionInput(
    finding?.fix.suggestions ?? [],
  )

  const handleConfirm = async () => {
    const { currentAtsConfig, isReportAccountCurrent } = useAtsStore.getState()
    const isCurrent = isReportAccountCurrent()

    if (!currentAtsConfig) {
      return
    }

    const updatedSuggestions =
      currentAtsConfig.findings[severity]
        .find((f) => f.id === id)
        ?.fix.suggestions?.filter((item) => !item.fixed) ?? []

    if (updatedSuggestions.length === 0) {
      toast.error('当前修复建议不完整，请重新运行 ATS 检测')

      return
    }

    if (hasUnresolvedSuggestionInput(updatedSuggestions)) {
      toast.info('请先在“自定义”中填写真实信息，再确认应用')

      return
    }

    setIsFixing(true)

    const updatedFinding = currentAtsConfig.findings[severity].map((f) => {
      if (f.id === id) {
        return {
          ...f,
          fix: {
            ...f.fix,
            suggestions: (f.fix.suggestions || []).map((s) => ({
              ...s,
              fixed: true,
            })),
          },
        }
      }

      return f
    })

    try {
      const [{ syncAutomergeDocument }, { updateAtsConfig }] =
        await Promise.all([
          import('@/lib/automerge/document/sync'),
          import('@/lib/supabase/resume/ats'),
        ])

      if (!isCurrent()) return

      const nextFindings = {
        ...currentAtsConfig.findings,
        [severity]: updatedFinding,
      }

      await syncAutomergeDocument(
        currentAtsConfig.resume_id,
        updatedSuggestions,
        { syncToResumeConfig: true },
      )

      if (!isCurrent()) return

      await updateAtsConfig(currentAtsConfig.id, { findings: nextFindings })

      if (!isCurrent()) return

      update('findings', nextFindings, currentAtsConfig.id)

      if (!reduceMotion)
        import('@/utils/confetti')
          .then(({ startConfetti }) => startConfetti(triggerRef))
          .catch(() => {})
    } catch (error) {
      if (!isCurrent()) return

      toast.error(getErrorMessage(error, '应用修改失败，请稍后重试'))
      console.error(error)
    } finally {
      setIsFixing(false)
    }
  }

  if (!finding) return null

  if (!isMobile) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{children}</DialogTrigger>
        <DialogContent className='flex h-[min(88dvh,56rem)] min-h-0 w-[60vw] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl'>
          <DialogHeader className='shrink-0 border-b px-4 pt-4 pb-3 md:px-5'>
            <DialogTitle className='flex items-center gap-2 text-base'>
              <Wand2 className='size-4 shrink-0 text-primary' />
              <span>问题修复详情</span>
              <Badge
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs',
                  config.badgeBg,
                  config.badgeText,
                )}
              >
                <config.icon className='size-3 lg:size-4' />
              </Badge>
            </DialogTitle>
            <DialogDescription
              className={cn(
                'line-clamp-2 text-left text-xs text-muted-foreground/90',
                config.badgeText,
              )}
            >
              {finding.title}
            </DialogDescription>
          </DialogHeader>

          <Content
            id={id}
            severity={severity}
            onReadyChange={setContentReady}
          />

          <DialogFooter className='shrink-0 border-t bg-muted/30 px-4 py-3'>
            <DialogClose asChild>
              <Button variant='outline'>取消</Button>
            </DialogClose>
            <Button
              ref={triggerRef}
              onClick={handleConfirm}
              disabled={!contentReady || isFixing || allFixed}
            >
              {allFixed ? '已修复' : needsUserInput ? '补充后应用' : '确认修复'}
              {isFixing ? <Spinner /> : null}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={setOpen} showSwipeHandle>
      <DrawerTrigger render={children} />
      <DrawerContent overlayClassName='supports-backdrop-filter:backdrop-blur-none'>
        <DrawerHeader className='shrink-0 border-b px-4 pt-4 pb-3 text-left'>
          <DrawerTitle className='flex items-center gap-2 text-left text-base'>
            <Wand2 className='size-4 shrink-0 text-primary' />
            <span>问题修复详情</span>
            <Badge
              className={cn(
                'rounded-full px-2 py-0.5 text-xs',
                config.badgeBg,
                config.badgeText,
              )}
            >
              <config.icon className='size-3 lg:size-4' />
            </Badge>
          </DrawerTitle>
          <DrawerDescription
            className={cn(
              'line-clamp-2 text-left text-xs text-muted-foreground/90',
              config.badgeText,
            )}
          >
            {finding.title}
          </DrawerDescription>
        </DrawerHeader>

        <Content id={id} severity={severity} onReadyChange={setContentReady} />

        <DrawerFooter className='shrink-0 border-t bg-muted/30 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] md:flex md:flex-row md:justify-end md:gap-2'>
          <DrawerClose render={<Button variant='outline' />}>取消</DrawerClose>
          <Button
            ref={triggerRef}
            onClick={handleConfirm}
            disabled={!contentReady || isFixing || allFixed}
          >
            {allFixed ? '已修复' : needsUserInput ? '补充后应用' : '确认修复'}
            {isFixing && <Spinner />}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

export default IssueFix
