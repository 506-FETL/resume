import type { Finding, Severity, SeverityConfigVariant, Suggestion } from '../../../types'
import { AlertTriangle, BadgeQuestionMark, Code2, Edit3, FileDiff, Lightbulb, ListOrdered } from 'lucide-react'
import { motion } from 'motion/react'
import { Badge } from '@/components/ui/badge'
import { CodeBlock } from '@/components/ui/code-block'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import useAtsStore from '@/pages/optimize/store'
import SuggestionEditor from '../custom-editor'
import { SuggestionCompareCard } from '../custom-editor/renderer'

interface IssueFixContentProps {
  finding: Finding
  locationText: string
  steps: string[]
  suggestions: Suggestion[]
  beforeCode: string
  afterCode: string
  config: SeverityConfigVariant
  severity: Severity
  id: string
}

function IssueFixContent({
  finding,
  locationText,
  steps,
  suggestions,
  beforeCode,
  afterCode,
  config,
  severity,
  id,
}: IssueFixContentProps) {
  const { update, currentAtsConfig } = useAtsStore()

  const handleOk = (newSuggestions: Suggestion[]) => {
    if (!currentAtsConfig?.findings)
      return

    const updatedFinding = currentAtsConfig.findings[severity].map((finding) => {
      if (finding.id === id) {
        return { ...finding, fix: { ...finding.fix, suggestions: newSuggestions } }
      }
      return finding
    })
    update('findings', { ...currentAtsConfig.findings, [severity]: updatedFinding })
  }

  return (
    <div className="space-y-4 sm:space-y-5 lg:space-y-8">
      {/* 信息概览卡片 */}
      <div className="space-y-1.5 lg:space-y-2">
        <span className={cn('text-xs lg:text-sm font-medium text-muted-foreground flex items-center gap-1.5 lg:gap-2', config.textColor)}>
          <BadgeQuestionMark className="size-3.5 lg:size-4" />
          问题位置
        </span>
        <Badge variant="secondary" className={cn('text-xs lg:text-sm font-normal px-2.5 py-1 lg:px-3 lg:py-1.5 bg-muted text-foreground border border-border/50 max-w-full', config.badgeBg, config.badgeText)}>
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
          <p className="text-xs sm:text-sm lg:text-base font-medium leading-relaxed text-foreground/90 bg-green-500/5 p-2.5 sm:p-3 lg:p-4 rounded-lg border border-green-500/10 dark:bg-green-950/20 dark:border-green-500/20">
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
        <TabsList>
          <TabsTrigger value="summary">
            <FileDiff className="size-3 sm:size-3.5 lg:size-4 shrink-0" />
            <span className="hidden xs:inline">改动</span>
            修改对比
          </TabsTrigger>
          <TabsTrigger value="code">
            <Code2 className="size-3 sm:size-3.5 lg:size-4 shrink-0" />
            <span className="hidden xs:inline">代码</span>
            查看代码
          </TabsTrigger>
          <TabsTrigger value="edit">
            <Edit3 className="size-3 sm:size-3.5 lg:size-4 shrink-0" />
            自定义
          </TabsTrigger>
        </TabsList>

        <div className="border rounded-lg bg-card p-2">
          <TabsContent value="summary">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="p-2 sm:p-4 lg:p-6 space-y-4 lg:space-y-6 "
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

          <TabsContent value="code">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="p-2 sm:p-4 lg:p-6"
            >
              <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2 lg:gap-6">
                <CodeBlock language="json" filename="before.json" className="text-sm lg:text-base" showLineNumbers>
                  {beforeCode}
                </CodeBlock>
                <CodeBlock language="json" filename="after.json" className="text-sm lg:text-base" showLineNumbers>
                  {afterCode}
                </CodeBlock>
              </div>
            </motion.div>
          </TabsContent>

          <TabsContent value="edit" className="p-2 sm:p-4 lg:p-6">
            <SuggestionEditor
              suggestions={suggestions}
              onOk={handleOk}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

export default IssueFixContent
