import type { ReactElement } from 'react'
import type { Severity } from '@/pages/optimize/types'
import { Wand2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { Spinner } from '@/components/ui/spinner'
import { useIsMobile } from '@/hooks/use-mobile'
import { syncAutomergeDocument } from '@/lib/automerge'
import { updateAtsConfig } from '@/lib/supabase/resume'
import { cn } from '@/lib/utils'
import { severityConfig } from '@/pages/optimize/const'
import useAtsStore from '@/pages/optimize/store'
import { startConfetti } from '@/utils'
import Content from './content'

interface IssueFixProps {
  children: ReactElement
  id: string
  severity: Severity
}

function IssueFix({ id, severity, children }: IssueFixProps) {
  const config = severityConfig[severity]
  const [open, setOpen] = useState(false)
  const [isFixing, setIsFixing] = useState(false)
  const isMobile = useIsMobile()
  const { update, currentAtsConfig } = useAtsStore()
  const triger = useRef<HTMLButtonElement | null>(null)

  const finding = currentAtsConfig?.findings?.[severity]?.find(f => f.id === id)
  const allFixed = finding?.fix.suggestions?.length ? finding.fix.suggestions.every(s => s.fixed) : false

  const handleConfirm = async () => {
    if (!currentAtsConfig) {
      return
    }

    setIsFixing(true)

    const updatedFinding = currentAtsConfig.findings[severity].map((f) => {
      if (f.id === id) {
        return {
          ...f,
          fix: {
            ...f.fix,
            suggestions: (f.fix.suggestions || []).map(s => ({ ...s, fixed: true })),
          },
        }
      }
      return f
    })

    const updatedSuggestions = currentAtsConfig
      .findings[severity]
      .find(f => f.id === id)
      ?.fix
      .suggestions

    try {
      await updateAtsConfig(currentAtsConfig.id, {
        findings: { ...currentAtsConfig.findings, [severity]: updatedFinding },
      })

      if (updatedSuggestions && updatedSuggestions.length > 0) {
        await syncAutomergeDocument(
          currentAtsConfig.resume_id,
          updatedSuggestions,
          { syncToResumeConfig: true },
        )
      }

      update('findings', { ...currentAtsConfig.findings, [severity]: updatedFinding })
      startConfetti(triger)
    }
    catch (error) {
      toast.error('修复除了点问题, 请稍后重试')
      console.error(error)
    }
    finally {
      setIsFixing(false)
    }
  }

  if (!finding)
    return null

  if (!isMobile) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {children}
        </DialogTrigger>
        <DialogContent className="flex h-[min(88dvh,56rem)] min-h-0 w-[min(70rem,calc(100vw-3rem))] max-w-none flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b px-4 pt-4 pb-3 md:px-5">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Wand2 className="size-4 shrink-0 text-primary" />
              <span>问题修复详情</span>
              <Badge className={cn('rounded-full px-2 py-0.5 text-xs', config.badgeBg, config.badgeText)}>
                <config.icon className="size-3 lg:size-4" />
              </Badge>
            </DialogTitle>
            <DialogDescription className={cn('line-clamp-2 text-left text-xs text-muted-foreground/90', config.badgeText)}>{finding.title}</DialogDescription>
          </DialogHeader>

          <Content id={id} severity={severity} />

          <DialogFooter className="shrink-0 border-t bg-muted/30 px-4 py-3">
            <DialogClose asChild>
              <Button variant="outline">取消</Button>
            </DialogClose>
            <Button ref={triger} onClick={handleConfirm} disabled={isFixing || allFixed}>
              {allFixed ? '已修复' : '确认'}
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
      <DrawerContent
        className="h-[92dvh]"
        overlayClassName="supports-backdrop-filter:backdrop-blur-none"
      >
        <DrawerHeader className="shrink-0 border-b px-4 pt-4 pb-3 text-left">
          <DrawerTitle className="flex items-center gap-2 text-left text-base">
            <Wand2 className="size-4 shrink-0 text-primary" />
            <span>问题修复详情</span>
            <Badge className={cn('rounded-full px-2 py-0.5 text-xs', config.badgeBg, config.badgeText)}>
              <config.icon className="size-3 lg:size-4" />
            </Badge>
          </DrawerTitle>
          <DrawerDescription className={cn('line-clamp-2 text-left text-xs text-muted-foreground/90', config.badgeText)}>{finding.title}</DrawerDescription>
        </DrawerHeader>

        <Content id={id} severity={severity} />

        <DrawerFooter className="shrink-0 border-t bg-muted/30 px-4 py-3 md:flex md:flex-row md:justify-end md:gap-2">
          <DrawerClose render={<Button variant="outline" />}>
            取消
          </DrawerClose>
          <Button ref={triger} onClick={handleConfirm} disabled={isFixing || allFixed}>
            {allFixed ? '已修复' : '确认'}
            {isFixing && <Spinner /> }
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

export default IssueFix
