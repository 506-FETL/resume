import type { BatchOptimizationItem } from './types'
import type { Suggestion } from '@/pages/optimize/types'
import { ChevronDown, ListOrdered, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { severityConfig } from '@/pages/optimize/const'
import CustomEditor from '../../analysis/custom-editor'
import { SuggestionCompareCard } from '../../analysis/custom-editor/renderer'

interface FormatterFindingCardProps {
  item: BatchOptimizationItem
  onSuggestionsChange: (findingId: string, suggestions: Suggestion[]) => void
}

function FormatterFindingCard({ item, onSuggestionsChange }: FormatterFindingCardProps) {
  const config = severityConfig[item.severity]
  const Icon = config.icon

  return (
    <Collapsible className={cn('w-full min-w-0 max-w-full overflow-hidden rounded-2xl border transition-all', config.borderColor, config.bgColor)}>
      <CollapsibleTrigger className="flex w-full min-w-0 max-w-full items-start justify-between gap-3 overflow-hidden p-4 text-left transition-colors hover:bg-background/40">
        <div className="min-w-0 space-y-2">
          <div className="flex items-start gap-2.5">
            <div className={cn('mt-0.5 shrink-0', config.textColor)}>
              <Icon className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="wrap-break-word whitespace-normal text-sm font-medium leading-6 text-foreground">{item.title}</p>
              <p className="wrap-break-word whitespace-normal text-xs leading-5 text-muted-foreground">{item.locationText}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pl-6">
            <Badge className={cn('rounded-full border-transparent', config.badgeBg, config.badgeText)}>
              {config.label}
            </Badge>
            <Badge variant="secondary" className="rounded-full">
              可应用
              {' '}
              {item.autoApplicableSuggestionCount}
              /
              {item.pendingSuggestionCount}
            </Badge>
            {item.conflictedSuggestionCount > 0 && (
              <Badge
                variant="outline"
                className="rounded-full border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
              >
                冲突保留
                {' '}
                {item.conflictedSuggestionCount}
              </Badge>
            )}
            {item.requiresInputSuggestionCount > 0 && (
              <Badge
                variant="outline"
                className="rounded-full border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
              >
                待补充
                {' '}
                {item.requiresInputSuggestionCount}
              </Badge>
            )}
          </div>
        </div>

        <ChevronDown className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
      </CollapsibleTrigger>

      <CollapsibleContent className="min-w-0 max-w-full overflow-hidden">
        <div className="min-w-0 max-w-full space-y-5 px-4 pb-4">
          <Separator className="opacity-60" />

          <div className="space-y-1.5">
            <p className={cn('text-xs font-semibold uppercase tracking-wide', config.textColor)}>修复建议</p>
            <p className="wrap-break-word whitespace-normal text-sm leading-6 text-foreground/90">{item.fixSummary}</p>
          </div>

          {item.steps.length > 0 && (
            <div className="space-y-2">
              <div className={cn('flex items-center gap-2 text-xs font-semibold uppercase tracking-wide', config.textColor)}>
                <ListOrdered className="size-3.5" />
                执行步骤
              </div>
              <ul className="min-w-0 max-w-full space-y-2 rounded-xl border border-border/50 bg-background/60 p-4">
                {item.steps.map(step => (
                  <li key={step} className="flex items-start gap-2 text-sm leading-6 text-foreground/85">
                    <span className={cn('mt-2 size-1.5 shrink-0 rounded-full', config.textColor.replace('text-', 'bg-'))} />
                    <span className="wrap-break-word whitespace-normal">{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {item.conflictedSuggestionCount > 0 && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm leading-6 text-amber-800 dark:text-amber-200">
              当前有
              {' '}
              {item.conflictedSuggestionCount}
              {' '}
              条建议与更高优先级问题修改同一字段。你可以先调整下面的“修改后”内容，再重新一键应用。
            </div>
          )}

          {item.requiresInputSuggestionCount > 0 && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm leading-6 text-amber-800 dark:text-amber-200">
              当前有
              {' '}
              {item.requiresInputSuggestionCount}
              {' '}
              条建议需要补充或确认真实信息。请在下方“自定义调整”中完成编辑，确认后即可一键应用。
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Sparkles className="size-3.5" />
              修改对比
            </div>
            <div className="min-w-0 max-w-full space-y-3">
              {item.pendingSuggestions.map(suggestion => (
                <SuggestionCompareCard
                  key={`${item.findingId}-${suggestion.locate.path}-${suggestion.kind}-${JSON.stringify(suggestion.after)}`}
                  before={suggestion.before}
                  after={suggestion.after}
                  valueType={suggestion.valueType}
                  reason={suggestion.reason}
                  kind={suggestion.kind}
                  fixed={suggestion.fixed}
                />
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">自定义调整</div>
              <Badge variant="outline" className="rounded-full">
                {item.pendingSuggestions.length}
                {' '}
                条建议
              </Badge>
            </div>
            <div className="min-w-0 max-w-full overflow-hidden">
              <CustomEditor
                suggestions={item.pendingSuggestions}
                onChange={suggestions => onSuggestionsChange(item.findingId, suggestions)}
              />
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export default FormatterFindingCard
