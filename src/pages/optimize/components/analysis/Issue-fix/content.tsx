import type { Severity, Suggestion } from '@/pages/optimize/types'
import {
  AlertTriangle,
  BadgeQuestionMark,
  Code2,
  Edit3,
  FileDiff,
  Lightbulb,
  ListOrdered,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { CodeBlock } from '@/components/ui/code-block'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { hasUnresolvedSuggestionInput } from '@/lib/ats'
import { cn } from '@/lib/utils'
import { severityConfig } from '@/pages/optimize/const'
import useAtsStore from '@/pages/optimize/store'
import CustomEditor from '../custom-editor'
import { SuggestionCompareCard } from '../custom-editor/renderer'

interface IssueFixContentProps {
  severity: Severity
  id: string
}

function IssueFixContent({ severity, id }: IssueFixContentProps) {
  const { update, currentAtsConfig } = useAtsStore()

  const finding = currentAtsConfig?.findings?.[severity]?.find(
    (f) => f.id === id,
  )

  const config = severityConfig[severity]

  if (!finding) return null

  const evidence = finding.why.evidence[0]

  const locationText =
    [
      evidence?.locate.sectionLabel,
      evidence?.locate.itemLabel,
      evidence?.locate.fieldLabel,
    ]
      .filter(Boolean)
      .join(' / ') || '未定位到具体位置'

  const steps =
    finding.fix.steps.length > 0 ? finding.fix.steps : ['暂无步骤说明']

  const suggestions = finding.fix.suggestions || []
  const needsUserInput = hasUnresolvedSuggestionInput(suggestions)

  const beforeCode = JSON.stringify(
    suggestions.map((s) => s.before ?? null),
    null,
    2,
  )

  const afterCode = JSON.stringify(
    suggestions.map((s) => s.after ?? null),
    null,
    2,
  )

  const handleChange = (newSuggestions: Suggestion[]) => {
    if (!currentAtsConfig?.findings) return

    const updatedFinding = currentAtsConfig.findings[severity].map((f) => {
      if (f.id === id) {
        return { ...f, fix: { ...f.fix, suggestions: newSuggestions } }
      }

      return f
    })

    update('findings', {
      ...currentAtsConfig.findings,
      [severity]: updatedFinding,
    })
  }

  if (!finding) return null

  return (
    <div className='min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 sm:space-y-5 md:p-6 lg:space-y-8'>
      <div className='space-y-1.5 lg:space-y-2'>
        <span
          className={cn(
            'text-xs lg:text-sm font-medium text-muted-foreground flex items-center gap-1.5 lg:gap-2',
            config.textColor,
          )}
        >
          <BadgeQuestionMark className='size-3.5 lg:size-4' />
          问题位置
        </span>
        <Badge
          variant='secondary'
          className={cn(
            'text-xs lg:text-sm font-normal px-2.5 py-1 lg:px-3 lg:py-1.5 bg-muted text-foreground border border-border/50 max-w-full h-auto',
            config.badgeBg,
            config.badgeText,
          )}
        >
          <span className='whitespace-normal text-left'>{locationText}</span>
        </Badge>
      </div>

      <div className='grid gap-3 sm:gap-4 lg:gap-6 sm:grid-cols-2'>
        <div className='space-y-1.5 lg:space-y-2'>
          <span className='text-xs lg:text-sm font-medium text-muted-foreground flex items-center gap-1.5 lg:gap-2'>
            <AlertTriangle className='size-3.5 lg:size-4 text-destructive' />
            问题描述
          </span>
          <p className='text-sm leading-7 text-foreground/90'>
            {finding.why.summary}
          </p>
        </div>
        <div className='space-y-1.5 lg:space-y-2'>
          <span className='text-xs lg:text-sm font-medium text-muted-foreground flex items-center gap-1.5 lg:gap-2'>
            <Lightbulb className='size-3.5 lg:size-4 text-green-600' />
            修复建议
          </span>
          <p className='text-sm font-medium leading-7 text-foreground/90'>
            {finding.fix.summary}
          </p>
        </div>
      </div>

      <div className='space-y-2 lg:space-y-3'>
        <p className='text-xs lg:text-sm font-medium flex items-center gap-1.5 lg:gap-2 text-blue-600/80 dark:text-blue-400/80'>
          <span className='size-5 lg:size-6 rounded-md bg-blue-100/50 dark:bg-blue-900/20 flex items-center justify-center'>
            <ListOrdered className='size-3 lg:size-4' />
          </span>
          执行步骤
        </p>
        <div>
          <ol className='list-decimal space-y-2 pl-5 marker:text-muted-foreground'>
            {steps.map((step: string) => (
              <li key={step} className='pl-1'>
                <span className='text-foreground/90 leading-7 text-sm'>
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <Tabs defaultValue={needsUserInput ? 'edit' : 'summary'} className=''>
        <TabsList>
          <TabsTrigger value='summary'>
            <FileDiff className='size-3 sm:size-3.5 lg:size-4 shrink-0' />
            修改对比
          </TabsTrigger>
          <TabsTrigger value='code'>
            <Code2 className='size-3 sm:size-3.5 lg:size-4 shrink-0' />
            查看代码
          </TabsTrigger>
          <TabsTrigger value='edit'>
            <Edit3 className='size-3 sm:size-3.5 lg:size-4 shrink-0' />
            自定义
          </TabsTrigger>
        </TabsList>

        <div className='min-w-0 border-t pt-4'>
          {needsUserInput && (
            <div className='mx-1 mb-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-800 dark:text-amber-200'>
              请先在“自定义”中核实并补充真实信息，再应用修改。
            </div>
          )}
          <div className='flex items-center gap-2 mb-2 px-1'>
            <Badge
              variant='outline'
              className='text-xs font-normal px-2 py-0.5 h-6 bg-background'
            >
              共 {suggestions.length} 条建议
            </Badge>
          </div>
          <TabsContent value='summary'>
            <div className='space-y-6 h-full'>
              {suggestions.map((suggestion: Suggestion) => (
                <SuggestionCompareCard
                  key={`${suggestion.kind}-${suggestion.valueType}-${JSON.stringify(suggestion.after).slice(0, 20)}`}
                  before={suggestion.before}
                  after={suggestion.after}
                  valueType={suggestion.valueType}
                  reason={suggestion.reason}
                  kind={suggestion.kind}
                  fixed={suggestion.fixed}
                />
              ))}
              {suggestions.length === 0 && (
                <div className='text-center text-muted-foreground py-8 lg:py-12 text-xs lg:text-sm'>
                  暂无改动对比
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value='code'>
            <div>
              <div className='grid gap-3 sm:grid-cols-1 lg:grid-cols-2 lg:gap-6'>
                <CodeBlock
                  language='json'
                  filename='before.json'
                  className='text-sm lg:text-base'
                  showLineNumbers
                >
                  {beforeCode}
                </CodeBlock>
                <CodeBlock
                  language='json'
                  filename='after.json'
                  className='text-sm lg:text-base'
                  showLineNumbers
                >
                  {afterCode}
                </CodeBlock>
              </div>
            </div>
          </TabsContent>

          <TabsContent value='edit'>
            <CustomEditor suggestions={suggestions} onChange={handleChange} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

export default IssueFixContent
