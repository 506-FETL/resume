import type { SuggestionKind, ValueType } from '@/pages/optimize/types'
import { ArrowRight, Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { KIND_LABEL_MAP } from '@/pages/optimize/const'
import { detectValueType, isEmptyValue } from '@/pages/optimize/utils'
import { EmptyValue, HtmlStringValue, RENDERER_MAP, StringValue } from './field-renderers'

interface SuggestionValueRendererProps {
  value: unknown
  valueType: ValueType
  variant?: 'before' | 'after'
}

export function SuggestionValueRenderer({ value, valueType, variant }: SuggestionValueRendererProps) {
  if (isEmptyValue(value))
    return <EmptyValue />

  if (valueType === 'html_string')
    return <HtmlStringValue value={value as string} variant={variant} />

  const detectedType = detectValueType(value)
  const Renderer = RENDERER_MAP[detectedType] || StringValue

  return <Renderer value={value} variant={variant} />
}

interface SuggestionCompareCardProps {
  before: unknown
  after: unknown
  valueType: ValueType
  reason?: string
  kind?: SuggestionKind
  fixed?: boolean
}

export function SuggestionCompareCard({ before, after, valueType, reason, kind, fixed }: SuggestionCompareCardProps) {
  const kindConfig = kind ? KIND_LABEL_MAP[kind] : null

  return (
    <div className={cn(
      'min-w-0 max-w-full space-y-3 rounded-xl border p-3 transition-all duration-200 sm:p-4',
      fixed
        ? 'bg-primary/5 border-primary/20 shadow-sm'
        : 'bg-muted/10 border-border/50 hover:bg-muted/20',
    )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        {(kindConfig || reason) && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {kindConfig && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 gap-1 bg-muted">
                <kindConfig.icon className="size-2.5" />
                {kindConfig.label}
              </Badge>
            )}
            {reason && (
              <span className="text-muted-foreground">{reason}</span>
            )}
          </div>
        )}

        {fixed && (
          <Badge variant="outline" className="bg-background text-primary border-primary/20 gap-1 text-[10px] px-2 h-5">
            <Check className="size-2.5" />
            已修复
          </Badge>
        )}
      </div>

      <div className="grid min-w-0 gap-3 sm:grid-cols-1 lg:grid-cols-2">
        <div className={cn('min-w-0 space-y-1.5', fixed && 'opacity-60 grayscale')}>
          <div className="text-[10px] font-medium text-destructive/80 flex items-center gap-1">
            <span className="size-4 rounded bg-destructive/10 flex items-center justify-center">✕</span>
            修改前
          </div>
          <div className="bg-destructive/5 border border-destructive/10 rounded-lg p-2.5 min-h-12">
            <SuggestionValueRenderer value={before} valueType={valueType} variant="before" />
          </div>
        </div>

        <div className="min-w-0 space-y-1.5">
          <div className="text-[10px] font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
            <span className="size-4 rounded bg-green-500/10 dark:bg-green-500/20 flex items-center justify-center">
              <ArrowRight className="size-2.5" />
            </span>
            修改后
          </div>
          <div className={cn(
            'rounded-lg p-2.5 min-h-12 transition-colors',
            fixed
              ? 'bg-background border-2 border-primary/20 shadow-sm'
              : 'bg-green-500/5 dark:bg-green-950/20 border border-green-500/10 dark:border-green-500/20',
          )}
          >
            <SuggestionValueRenderer value={after} valueType={valueType} variant="after" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default SuggestionValueRenderer
