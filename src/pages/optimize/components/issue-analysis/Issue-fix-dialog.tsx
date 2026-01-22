import type { ReactNode } from 'react'
import type { Finding, Severity, Suggestion, ValueType } from '../../types'
import { AlertTriangle, ArrowRight, BadgeQuestionMark, Code2, FileDiff, Info, Lightbulb, ListOrdered, MessageSquare, Wand2, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CodeBlock } from '@/components/ui/code-block'
import { CodeComparison } from '@/components/ui/code-comparison'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { severityConfig } from '../../const'

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

  const defaultNote = `建议优先处理「${finding.title}」，按照“${finding.fix.summary}”进行完善。`

  const contentProps = { finding, severity, config, locationText, steps, suggestions, beforeCode, afterCode, defaultNote }

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          {children}
        </DrawerTrigger>
        <DrawerContent className="max-h-[90vh] px-4 pb-4">
          <DrawerHeader className="text-left">
            <DrawerTitle className="flex items-center gap-3 text-xl">
              <Wand2 className="size-5 text-primary" />
              <span>问题修复详情</span>
              <Badge className={cn(config.badgeBg, config.badgeText)}>
                {severity === 'high' && <XCircle className="size-3.5" />}
                {severity === 'medium' && <AlertTriangle className="size-3.5" />}
                {severity === 'low' && <Info className="size-3.5" />}
              </Badge>
            </DrawerTitle>
            <DrawerDescription className={cn('text-xs text-muted-foreground/90 text-left', config.badgeText)}>{finding.title}</DrawerDescription>
          </DrawerHeader>

          <ScrollArea className="overflow-y-auto">
            <IssueFixContent {...contentProps} />
          </ScrollArea>

          <DrawerFooter className="pt-2">
            <div className="flex gap-3 w-full">
              <DrawerClose asChild>
                <Button variant="outline" className="flex-1">取消</Button>
              </DrawerClose>
              <Button className="flex-1 shadow-md hover:shadow-lg transition-shadow">
                确认修复
                <ArrowRight className="ml-2 size-4" />
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
      <DialogContent className="sm:max-w-[600px] md:max-w-[700px] lg:max-w-[800px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <Wand2 className="size-5 text-primary" />
            <span>问题修复详情</span>
            <Badge className={cn('text-sm px-2.5 py-0.5 rounded-full font-medium shadow-none gap-1.5', config.badgeBg, config.badgeText, 'border-transparent')}>
              {severity === 'high' && <XCircle className="size-3.5" />}
              {severity === 'medium' && <AlertTriangle className="size-3.5" />}
              {severity === 'low' && <Info className="size-3.5" />}
              {config.label}
            </Badge>
          </DialogTitle>
          <DialogDescription className={cn('text-base text-muted-foreground/90 text-left', config.badgeText)}>{finding.title}</DialogDescription>
        </DialogHeader>

        <IssueFixContent {...contentProps} />

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">取消</Button>
          </DialogClose>
          <Button>
            确认
            <ArrowRight />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function IssueFixContent({ finding, locationText, steps, suggestions, beforeCode, afterCode, defaultNote }: any) {
  return (
    <div className="space-y-6">
      {/* 信息概览卡片 */}
      <div className="grid gap-2">
        <span className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
          <BadgeQuestionMark className="size-4" />
          问题位置
        </span>
        <Badge variant="secondary" className="text-sm font-normal px-3 py-1 bg-muted text-foreground border border-border/50">{locationText}</Badge>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <span className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <AlertTriangle className="size-4 text-destructive" />
            问题描述
          </span>
          <p className="text-sm leading-relaxed text-foreground/90 bg-destructive/5 p-3 rounded-lg border border-destructive/10">
            {finding.why.summary}
          </p>
        </div>
        <div className="space-y-2">
          <span className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <Lightbulb className="size-4 text-green-600" />
            修复建议
          </span>
          <p className="text-sm font-medium leading-relaxed text-foreground/90 bg-green-500/5 p-3 rounded-lg border border-green-500/10">
            {finding.fix.summary}
          </p>
        </div>
      </div>

      <div className="space-y-3 pt-2">
        <p className="text-sm font-semibold flex items-center gap-2 text-blue-600/80 dark:text-blue-400/80">
          <span className="size-6 rounded-md bg-blue-100/50 dark:bg-blue-900/20 flex items-center justify-center text-xs">
            <ListOrdered className="size-3.5" />
          </span>
          执行步骤
        </p>
        <div className="bg-muted/30 rounded-lg p-6 border border-border/50">
          <ul className="relative space-y-6 border-l-2 border-blue-200/50 dark:border-blue-800/50 ml-3 pl-6">
            {steps.map((step: string, i: number) => (
              <li key={step} className="relative group">
                <span className="absolute -left-[37px] top-0.5 flex size-6 items-center justify-center rounded-full bg-white dark:bg-zinc-950 border-2 border-blue-200/60 dark:border-blue-800/60 text-xs font-bold text-blue-600/80 dark:text-blue-400/80 ring-4 ring-background shadow-sm">
                  {i + 1}
                </span>
                <span className="text-foreground/90 leading-relaxed block text-sm md:text-base">{step}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <Tabs defaultValue="summary" className="w-full">
        <div className="flex items-center justify-between mb-4">
          <TabsList className="h-auto p-1 bg-muted/50 border border-border/50 w-full overflow-x-auto flex justify-start sm:justify-start">
            <TabsTrigger value="summary" className="px-4 text-sm gap-2 shrink-0">
              <FileDiff className="size-4" />
              改动对比
            </TabsTrigger>
            <TabsTrigger value="code" className="px-4 text-sm gap-2 shrink-0">
              <Code2 className="size-4" />
              代码对比
            </TabsTrigger>
            <TabsTrigger value="note" className="px-4 text-sm gap-2 shrink-0">
              <MessageSquare className="size-4" />
              自定义
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="min-h-[300px] ring-1 ring-border/40 rounded-xl bg-card">
          <TabsContent value="summary" className="m-0 p-5 space-y-5">
            {suggestions.map((suggestion: Suggestion, index: number) => (
              <div key={index} className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <span className=" p-1  text-xs  shrink-0">
                    {suggestion.kind === 'replace_text' && '文本替换'}
                    {suggestion.kind === 'replace_value' && '值替换'}
                    {suggestion.kind === 'fill_field' && '字段填充'}
                    {suggestion.kind === 'normalize_date' && '日期格式化'}
                    {!['replace_text', 'replace_value', 'fill_field', 'normalize_date'].includes(suggestion.kind) && suggestion.kind}
                  </span>
                  <span className="wrap-break-word">{suggestion.reason}</span>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-destructive flex items-center gap-1.5">
                      <XCircle className="size-3.5" />
                      修改前
                    </div>
                    <div className="bg-destructive/5 border border-destructive/10 rounded-md p-3 text-sm text-muted-foreground break-all">
                      <SuggestionValue value={suggestion.before} type={suggestion.valueType} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-medium text-green-600 flex items-center gap-1.5">
                      <ArrowRight className="size-3.5" />
                      修改后
                    </div>
                    <div className="bg-green-500/5 border border-green-500/10 rounded-md p-3 text-sm text-foreground break-all">
                      <SuggestionValue value={suggestion.after} type={suggestion.valueType} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {suggestions.length === 0 && (
              <div className="text-center text-muted-foreground py-10">
                暂无具体的改动对比数据
              </div>
            )}
          </TabsContent>

          <TabsContent value="code" className="m-0 p-5 space-y-5 md:flex md:gap-5 md:justify-center">
            <CodeBlock language="json" filename="before.json" className="max-w-85 max-h-[300px] overflow-auto">
              {beforeCode}
            </CodeBlock>
            <CodeBlock language="json" filename="after.json" className="max-w-85 max-h-[300px] overflow-auto">
              {afterCode}
            </CodeBlock>
          </TabsContent>

          <TabsContent value="note" className="m-0 p-5 space-y-5">
            <Textarea
              defaultValue={defaultNote}
              placeholder="在此输入您的自定义修复说明..."
              className="min-h-[200px]"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span className="flex items-center gap-1.5">
                <Info className="size-3.5" />
                支持 Markdown 格式
              </span>
              <span>可根据实际情况调整说明内容</span>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

function SuggestionValue({ value, type }: { value: any, type: ValueType }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground/50 italic">Empty</span>
  }

  if (type === 'html_string') {
    return <div dangerouslySetInnerHTML={{ __html: value }} className="prose prose-sm dark:prose-invert max-w-none" />
  }

  if (type === 'string_array') {
    return (
      <ul className="list-disc list-inside space-y-1">
        {(value as string[]).map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    )
  }

  if (type === 'object_array') {
    return (
      <div className="space-y-2">
        {(value as any[]).map((item, i) => (
          <div key={i} className="bg-background/50 p-2 rounded border border-border/50 text-xs">
            {Object.entries(item).map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <span className="font-semibold opacity-70">
                  {k}
                  :
                </span>
                <span>{String(v)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  }

  return <span>{String(value)}</span>
}

export default IssueFixDialog
