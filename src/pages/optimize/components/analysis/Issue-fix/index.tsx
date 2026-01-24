import type { PropsWithChildren } from 'react'
import type { Finding, Severity } from '../../../types'
import { Wand2 } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { severityConfig } from '../../../const'
import IssueFixContent from './issue-fix-content'

interface IssueFixProps {
  finding: Finding
  severity: Severity
}

function IssueFix({ finding, severity, children }: PropsWithChildren<IssueFixProps>) {
  const config = severityConfig[severity]
  const [open, setOpen] = useState(false)

  const evidence = finding.why.evidence[0]
  const id = finding.id
  const locationText = [evidence?.locate.sectionLabel, evidence?.locate.itemLabel, evidence?.locate.fieldLabel].filter(Boolean).join(' / ') || '未定位到具体位置'
  const steps = finding.fix.steps.length > 0 ? finding.fix.steps : ['暂无具体步骤说明']
  const suggestions = finding.fix.suggestions || []

  const beforeCode = JSON.stringify(suggestions.map(s => s.before).filter(Boolean), null, 2)
  const afterCode = JSON.stringify(suggestions.map(s => s.after).filter(Boolean), null, 2)

  const contentProps = { finding, locationText, steps, suggestions, beforeCode, afterCode, config, severity, id }

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

        <ScrollArea className="flex-1 px-4 py-4 overflow-y-auto">
          <IssueFixContent {...contentProps} />
        </ScrollArea>

        <DrawerFooter className="px-4 py-3 shrink-0 border-t bg-muted/30 md:flex md:flex-row md:gap-2 md:justify-end">
          <DrawerClose asChild>
            <Button variant="outline">取消</Button>
          </DrawerClose>
          <Button>
            确认
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

export default IssueFix
