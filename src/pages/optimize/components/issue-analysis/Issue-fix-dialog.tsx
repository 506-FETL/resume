import type { ReactNode } from 'react'
import type { Finding, Severity, Suggestion } from '../../types'
import { AlertTriangle, ArrowRight, BadgeQuestionMark, Code2, Edit3, FileDiff, Info, Lightbulb, ListOrdered, Wand2, XCircle } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CodeBlock } from '@/components/ui/code-block'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { severityConfig } from '../../const'
import SuggestionEditor from './suggestion-editor'
import { SuggestionCompareCard } from './suggestion-value-renderer'

function IssueFixDialog({ finding, severity, children }: { finding: Finding, severity: Severity, children: ReactNode }) {
  const config = severityConfig[severity]
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)

  const evidence = finding.why.evidence[0]
  const locationText = [evidence?.locate.sectionLabel, evidence?.locate.itemLabel, evidence?.locate.fieldLabel].filter(Boolean).join(' / ') || '未定位到具体位置'
  const steps = finding.fix.steps.length > 0 ? finding.fix.steps : ['暂无具体步骤说明']
  const suggestions = finding.fix.suggestions || []

  // Construct code comparison strings (fallback if suggestions are not code-based or specific enough)
  const beforeCode = JSON.stringify(suggestions.map(s => s.before).filter(Boolean), null, 2)
  const afterCode = JSON.stringify(suggestions.map(s => s.after).filter(Boolean), null, 2)

  const contentProps = { finding, severity, config, locationText, steps, suggestions, beforeCode, afterCode }

  if (isMobile) {
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
                {severity === 'high' && <XCircle className="size-3" />}
                {severity === 'medium' && <AlertTriangle className="size-3" />}
                {severity === 'low' && <Info className="size-3" />}
              </Badge>
            </DrawerTitle>
            <DrawerDescription className={cn('text-xs text-muted-foreground/90 text-left line-clamp-2', config.badgeText)}>{finding.title}</DrawerDescription>
          </DrawerHeader>

          <ScrollArea className="flex-1 px-4 py-4 overflow-y-auto">
            <IssueFixContent {...contentProps} />
          </ScrollArea>

          <DrawerFooter className="px-4 py-3 shrink-0 border-t bg-muted/30">
            <div className="flex gap-2 w-full">
              <DrawerClose asChild>
                <Button variant="outline" size="sm" className="flex-1">取消</Button>
              </DrawerClose>
              <Button size="sm" className="flex-1">
                确认修复
                <ArrowRight className="size-3.5" />
              </Button>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="w-[65vw] max-w-[100vw]! h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 shrink-0 border-b">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg lg:text-xl">
            <Wand2 className="size-4 sm:size-5 lg:size-6 text-primary shrink-0" />
            <span>问题修复详情</span>
            <Badge className={cn('text-xs lg:text-sm px-2 py-0.5 lg:px-3 lg:py-1 rounded-full font-medium shadow-none gap-1 shrink-0', config.badgeBg, config.badgeText, 'border-transparent')}>
              {severity === 'high' && <XCircle className="size-3 lg:size-4" />}
              {severity === 'medium' && <AlertTriangle className="size-3 lg:size-4" />}
              {severity === 'low' && <Info className="size-3 lg:size-4" />}
              {config.label}
            </Badge>
          </DialogTitle>
          <DialogDescription className={cn('text-sm lg:text-base text-muted-foreground/90 text-left line-clamp-2', config.badgeText)}>{finding.title}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-4 py-4 sm:px-6 sm:py-6 overflow-y-auto">
          <IssueFixContent {...contentProps} />
        </ScrollArea>

        <DialogFooter className="px-4 py-3 sm:px-6 sm:py-4 shrink-0 border-t bg-muted/30">
          <DialogClose asChild>
            <Button variant="outline" size="sm" className="lg:h-11 lg:px-8 lg:text-base">取消</Button>
          </DialogClose>
          <Button size="sm" className="lg:h-11 lg:px-8 lg:text-base">
            确认
            <ArrowRight className="size-3.5 lg:size-4 ml-2" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function IssueFixContent({ finding, locationText, steps, suggestions, beforeCode, afterCode }: any) {
  return (
    <div className="space-y-4 sm:space-y-5 lg:space-y-8">
      {/* 信息概览卡片 */}
      <div className="space-y-1.5 lg:space-y-2">
        <span className="text-xs lg:text-sm font-medium text-muted-foreground flex items-center gap-1.5 lg:gap-2">
          <BadgeQuestionMark className="size-3.5 lg:size-4" />
          问题位置
        </span>
        <Badge variant="secondary" className="text-xs lg:text-sm font-normal px-2.5 py-1 lg:px-3 lg:py-1.5 bg-muted text-foreground border border-border/50 max-w-full">
          <span className="truncate">{locationText}</span>
        </Badge>
      </div>

      <div className="grid gap-3 sm:gap-4 lg:gap-6 sm:grid-cols-2">
        <div className="space-y-1.5 lg:space-y-2">
          <span className="text-xs lg:text-sm font-medium text-muted-foreground flex items-center gap-1.5 lg:gap-2">
            <AlertTriangle className="size-3.5 lg:size-4 text-destructive" />
            问题描述
          </span>
          <p className="text-xs sm:text-sm lg:text-base leading-relaxed text-foreground/90 bg-destructive/5 p-2.5 sm:p-3 lg:p-4 rounded-lg border border-destructive/10">
            {finding.why.summary}
          </p>
        </div>
        <div className="space-y-1.5 lg:space-y-2">
          <span className="text-xs lg:text-sm font-medium text-muted-foreground flex items-center gap-1.5 lg:gap-2">
            <Lightbulb className="size-3.5 lg:size-4 text-green-600" />
            修复建议
          </span>
          <p className="text-xs sm:text-sm lg:text-base font-medium leading-relaxed text-foreground/90 bg-green-500/5 p-2.5 sm:p-3 lg:p-4 rounded-lg border border-green-500/10">
            {finding.fix.summary}
          </p>
        </div>
      </div>

      <div className="space-y-2 lg:space-y-3">
        <p className="text-xs lg:text-sm font-medium flex items-center gap-1.5 lg:gap-2 text-blue-600/80 dark:text-blue-400/80">
          <span className="size-5 lg:size-6 rounded-md bg-blue-100/50 dark:bg-blue-900/20 flex items-center justify-center">
            <ListOrdered className="size-3 lg:size-4" />
          </span>
          执行步骤
        </p>
        <div className="bg-muted/30 rounded-lg p-3 sm:p-4 lg:p-6 border border-border/50">
          <ul className="relative space-y-3 sm:space-y-4 lg:space-y-6 border-l-2 border-blue-200/50 dark:border-blue-800/50 ml-2 lg:ml-3 pl-4 sm:ml-3 sm:pl-5 lg:pl-6">
            {steps.map((step: string, i: number) => (
              <li key={step} className="relative group">
                <span className="absolute -left-[25px] sm:-left-[29px] lg:-left-[35px] top-0 lg:top-0.5 flex size-5 lg:size-7 items-center justify-center rounded-full bg-white dark:bg-zinc-950 border-2 border-blue-200/60 dark:border-blue-800/60 text-[10px] lg:text-xs font-bold text-blue-600/80 dark:text-blue-400/80 ring-2 ring-background">
                  {i + 1}
                </span>
                <span className="text-foreground/90 leading-relaxed block text-xs sm:text-sm lg:text-base">{step}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <Tabs defaultValue="summary">
        <TabsList className="h-auto p-0.5 bg-muted/50 border border-border/50 grid grid-cols-3">
          <TabsTrigger value="summary" className="px-2 sm:px-3 lg:px-4 py-1.5 lg:py-2.5 text-xs lg:text-sm gap-1 sm:gap-1.5 lg:gap-2">
            <FileDiff className="size-3 sm:size-3.5 lg:size-4 shrink-0" />
            <span className="hidden xs:inline">改动</span>
            对比
          </TabsTrigger>
          <TabsTrigger value="code" className="px-2 sm:px-3 lg:px-4 py-1.5 lg:py-2.5 text-xs lg:text-sm gap-1 sm:gap-1.5 lg:gap-2">
            <Code2 className="size-3 sm:size-3.5 lg:size-4 shrink-0" />
            <span className="hidden xs:inline">代码</span>
            对比
          </TabsTrigger>
          <TabsTrigger value="edit" className="px-2 sm:px-3 lg:px-4 py-1.5 lg:py-2.5 text-xs lg:text-sm gap-1 sm:gap-1.5 lg:gap-2">
            <Edit3 className="size-3 sm:size-3.5 lg:size-4 shrink-0" />
            自定义
          </TabsTrigger>
        </TabsList>

        <div className="border rounded-lg bg-card">
          <TabsContent value="summary">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="p-2 sm:p-4 lg:p-6 space-y-4 lg:space-y-6"
            >
              {suggestions.map((suggestion: Suggestion) => (
                <SuggestionCompareCard
                  key={`${suggestion.kind}-${suggestion.valueType}-${JSON.stringify(suggestion.after).slice(0, 20)}`}
                  before={suggestion.before}
                  after={suggestion.after}
                  valueType={suggestion.valueType}
                  reason={suggestion.reason}
                  kind={suggestion.kind}
                />
              ))}
              {suggestions.length === 0 && (
                <div className="text-center text-muted-foreground py-8 lg:py-12 text-xs lg:text-sm">
                  暂无具体的改动对比数据
                </div>
              )}
            </motion.div>
          </TabsContent>

          <TabsContent value="code" className="m-0 overflow-hidden">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="p-2 sm:p-4 lg:p-6"
            >
              <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2 lg:gap-6">
                <CodeBlock language="json" filename="before.json" className="text-sm lg:text-base">
                  {beforeCode}
                </CodeBlock>
                <CodeBlock language="json" filename="after.json" className="text-sm lg:text-base">
                  {afterCode}
                </CodeBlock>
              </div>
            </motion.div>
          </TabsContent>

          <TabsContent value="edit" className="m-0 p-2 sm:p-4 lg:p-6">
            <SuggestionEditor
              suggestions={suggestions}
              onChange={(newSuggestions) => {
                // TODO: 处理修改后的建议
              }}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

export default IssueFixDialog
