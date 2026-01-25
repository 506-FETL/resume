import type { PropsWithChildren } from 'react'
import type { Severity } from '../../../types'
import { Wand2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { Spinner } from '@/components/ui/spinner'
import { useIsMobile } from '@/hooks/use-mobile'
import { DocumentManager } from '@/lib/automerge/document-manager'
import { updateAtsConfig } from '@/lib/supabase/resume'
import { cn } from '@/lib/utils'
import { severityConfig } from '../../../const'
import useAtsStore from '../../../store'
import Content from './content'

interface IssueFixProps {
  id: string
  severity: Severity
}

function IssueFix({ id, severity, children }: PropsWithChildren<IssueFixProps>) {
  const config = severityConfig[severity]
  const [open, setOpen] = useState(false)
  const [isFixing, setIsFixing] = useState(false)
  const isMobile = useIsMobile()
  const { update, currentAtsConfig } = useAtsStore()

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
        // 使用静态方法同步文档和配置
        await DocumentManager.syncAutomergeDocument(
          currentAtsConfig.resume_id,
          updatedSuggestions,
          { syncToResumeConfig: true },
        )
      }

      update('findings', { ...currentAtsConfig.findings, [severity]: updatedFinding })
      toast.success('修复成功')
    }
    catch (error) {
      toast.error('修复除了点问题, 请稍后重试')
      console.error(error)
    }
    finally {
      setOpen(false)
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
        <DialogContent className="flex flex-col h-[85vh] max-w-5xl! w-[64vw] gap-0 p-0">
          <DialogHeader className="px-4 pt-4 pb-3 shrink-0 border-b">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Wand2 className="size-4 text-primary shrink-0" />
              <span>问题修复详情</span>
              <Badge className={cn('text-xs px-2 py-0.5 rounded-full', config.badgeBg, config.badgeText)}>
                <config.icon className="size-3 lg:size-4" />
              </Badge>
            </DialogTitle>
            <DialogDescription className={cn('text-xs text-muted-foreground/90 text-left line-clamp-2', config.badgeText)}>{finding.title}</DialogDescription>
          </DialogHeader>

          <Content id={id} severity={severity} />

          <DialogFooter className="px-4 py-3 shrink-0 border-t bg-muted/30">
            <DialogClose asChild>
              <Button variant="outline">取消</Button>
            </DialogClose>
            <Button onClick={handleConfirm} disabled={isFixing || allFixed}>
              {allFixed ? '已修复' : '确认'}
              {isFixing ? <Spinner /> : null}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        {children}
      </DrawerTrigger>
      <DrawerContent className="flex flex-col h-[85vh]">
        <DrawerHeader className="px-4 pt-4 pb-3 shrink-0 border-b">
          <DrawerTitle className="flex items-center gap-2 text-base">
            <Wand2 className="size-4 text-primary shrink-0" />
            <span>问题修复详情</span>
            <Badge className={cn('text-xs px-2 py-0.5 rounded-full', config.badgeBg, config.badgeText)}>
              <config.icon className="size-3 lg:size-4" />
            </Badge>
          </DrawerTitle>
          <DrawerDescription className={cn('text-xs text-muted-foreground/90 text-left line-clamp-2', config.badgeText)}>{finding.title}</DrawerDescription>
        </DrawerHeader>

        <Content id={id} severity={severity} />

        <DrawerFooter className="px-4 py-3 shrink-0 border-t bg-muted/30 md:flex md:flex-row md:gap-2 md:justify-end">
          <DrawerClose asChild>
            <Button variant="outline">取消</Button>
          </DrawerClose>
          <Button onClick={handleConfirm} disabled={isFixing || allFixed}>
            {allFixed ? '已修复' : '确认'}
            {isFixing ? <Spinner /> : null}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

export default IssueFix
