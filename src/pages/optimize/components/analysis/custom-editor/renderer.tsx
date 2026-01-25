import type { ComponentType } from 'react'
import type { SuggestionKind, ValueType } from '../../../types'
import type { SkillItem } from '@/lib/schema/resume/form/skillSpecialty'
import { ArrowRight, Calendar, Check, Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { KIND_LABEL_MAP, PROFICIENCY_MAP } from '../../../const'
import { detectValueType, getFieldLabel, isEmptyValue, renderValue } from '../../../utils'

// 空值
function EmptyValue() {
  return (
    <span className="text-muted-foreground/50 italic text-xs">空</span>
  )
}

// 字符串
function StringValue({ value, variant }: { value: string, variant?: 'before' | 'after' }) {
  if (isEmptyValue(value))
    return <EmptyValue />

  return (
    <span className={cn(
      'text-sm',
      variant === 'before' && 'text-muted-foreground line-through decoration-destructive/50 dark:decoration-red-400/50',
      variant === 'after' && 'text-foreground font-medium',
    )}
    >
      {value}
    </span>
  )
}

// TODO 使用安全的转换 HTML 字符串
function HtmlStringValue({ value, variant }: { value: string, variant?: 'before' | 'after' }) {
  if (isEmptyValue(value))
    return <EmptyValue />

  return (
    <div
      className={cn(
        'prose prose-sm dark:prose-invert max-w-none text-xs',
        '[&_p]:my-1 [&_ul]:my-1 [&_li]:my-0.5',
        variant === 'before' && 'opacity-60',
      )}
      dangerouslySetInnerHTML={{ __html: value }}
    />
  )
}

// 日期时间段
function DateRangeValue({ value, variant }: { value: string[], variant?: 'before' | 'after' }) {
  if (isEmptyValue(value))
    return <EmptyValue />

  const [start, end] = value
  const hasStart = !isEmptyValue(start)
  const hasEnd = !isEmptyValue(end)

  if (!hasStart && !hasEnd)
    return <EmptyValue />

  return (
    <div className={cn(
      'inline-flex items-center gap-1.5 text-xs',
      variant === 'before' && 'text-muted-foreground',
      variant === 'after' && 'text-foreground',
    )}
    >
      <Calendar className="size-3 shrink-0 opacity-60" />
      <span>{hasStart ? start : '未填'}</span>
      <span className="text-muted-foreground">至</span>
      <span>{hasEnd ? end : '至今'}</span>
    </div>
  )
}

// 技能项
function SkillItemValue({ value, variant }: { value: SkillItem, variant?: 'before' | 'after' }) {
  const percentage = PROFICIENCY_MAP[value.proficiencyLevel] || 50

  return (
    <div className={cn(
      'flex items-center gap-2 p-2 rounded-md border',
      variant === 'before' && 'bg-muted/30 border-border/50',
      variant === 'after' && 'bg-primary/5 border-primary/20 dark:bg-blue-500/10 dark:border-blue-500/20',
    )}
    >
      <Badge
        variant="secondary"
        className={cn(
          'shrink-0 text-[10px] px-1.5',
          variant === 'after' && 'bg-primary/10 text-primary dark:text-blue-300 dark:bg-blue-500/20',
        )}
      >
        {value.label}
      </Badge>
      <div className="flex-1 min-w-0">
        {value.displayType === 'percentage'
          ? (
              <div className="flex items-center gap-2">
                <Progress
                  value={percentage}
                  className="h-1.5 flex-1 dark:bg-blue-950/50 *:dark:bg-blue-500"
                />
                <span className="text-[10px] text-muted-foreground shrink-0">{value.proficiencyLevel}</span>
              </div>
            )
          : (
              <span className="text-xs text-muted-foreground">{value.proficiencyLevel}</span>
            )}
      </div>
    </div>
  )
}

// 技能列表
function SkillListValue({ value, variant }: { value: SkillItem[], variant?: 'before' | 'after' }) {
  if (isEmptyValue(value))
    return <EmptyValue />

  return (
    <div className="space-y-1.5">
      {value.map(skill => (
        <SkillItemValue key={`skill-${skill.label}-${skill.proficiencyLevel || 'default'}`} value={skill} variant={variant} />
      ))}
    </div>
  )
}

// 字符串数组
function StringArrayValue({ value, variant }: { value: string[], variant?: 'before' | 'after' }) {
  if (isEmptyValue(value))
    return <EmptyValue />

  return (
    <div className="flex flex-wrap gap-1">
      {value.map(item => (
        <Badge
          key={`tag-${item}`}
          variant="secondary"
          className={cn(
            'text-[10px] px-1.5 py-0.5',
            variant === 'before' && 'bg-muted/50 text-muted-foreground',
            variant === 'after' && 'bg-primary/10 text-primary dark:text-blue-300 dark:bg-blue-500/20',
          )}
        >
          {item}
        </Badge>
      ))}
    </div>
  )
}

// 证书列表
function CertificateListValue({ value, variant }: { value: Array<{ name: string }>, variant?: 'before' | 'after' }) {
  if (isEmptyValue(value))
    return <EmptyValue />

  return (
    <div className="flex flex-wrap gap-1">
      {value.map(cert => (
        <Badge
          key={`cert-${cert.name}`}
          variant="outline"
          className={cn(
            'text-[10px] px-1.5 py-0.5 gap-1',
            variant === 'before' && 'border-border/50 text-muted-foreground',
            variant === 'after' && 'border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400',
          )}
        >
          <Star className="size-2.5" />
          {cert.name}
        </Badge>
      ))}
    </div>
  )
}

// 通用对象
function ObjectValue({ value, variant }: { value: Record<string, unknown>, variant?: 'before' | 'after' }) {
  if (isEmptyValue(value))
    return <EmptyValue />

  const entries = Object.entries(value).filter(([_, v]) => !isEmptyValue(v))

  if (entries.length === 0)
    return <EmptyValue />

  return (
    <div className={cn(
      'space-y-1.5 p-2 rounded-md border text-xs',
      variant === 'before' && 'bg-muted/30 border-border/50',
      variant === 'after' && 'bg-primary/5 border-primary/20 dark:bg-blue-500/10 dark:border-blue-500/20',
    )}
    >
      {entries.map(([key, val]) => (
        <div key={key} className="flex items-start gap-2">
          <span className="text-muted-foreground shrink-0 min-w-16">
            {getFieldLabel(key)}
            :
          </span>
          <span className={cn(
            'flex-1',
            variant === 'after' && 'text-foreground font-medium',
          )}
          >
            {renderValue(val)}
          </span>
        </div>
      ))}
    </div>
  )
}

// 对象数组
function ObjectArrayValue({ value, variant }: { value: Array<Record<string, unknown>>, variant?: 'before' | 'after' }) {
  if (isEmptyValue(value))
    return <EmptyValue />

  return (
    <div className="space-y-2">
      {value.map(item => (
        <ObjectValue key={`obj-${JSON.stringify(item).slice(0, 50)}`} value={item} variant={variant} />
      ))}
    </div>
  )
}

// ================================
// 主渲染器
// ================================
interface SuggestionValueRendererProps {
  value: unknown
  valueType: ValueType
  variant?: 'before' | 'after'
}

// 渲染器组件映射表
const RENDERER_MAP: Record<string, ComponentType<{ value: any, variant?: 'before' | 'after' }>> = {
  date_range: DateRangeValue,
  skill_list: SkillListValue,
  skill_item: SkillItemValue,
  certificate_list: CertificateListValue,
  string_array: StringArrayValue,
  object_array: ObjectArrayValue,
  object: ObjectValue,
}

export function SuggestionValueRenderer({ value, valueType, variant }: SuggestionValueRendererProps) {
  // 先检测空值
  if (isEmptyValue(value)) {
    return <EmptyValue />
  }

  // HTML 字符串
  if (valueType === 'html_string') {
    return <HtmlStringValue value={value as string} variant={variant} />
  }

  // 根据检测到的类型选择对应的渲染组件
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
      'space-y-3 rounded-xl p-3 sm:p-4 border transition-all duration-200',
      fixed
        ? 'bg-primary/5 border-primary/20 shadow-sm'
        : 'bg-muted/10 border-border/50 hover:bg-muted/20',
    )}
    >
      {/* Header */}
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

      {/* Compare */}
      <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
        {/* Before */}
        <div className={cn('space-y-1.5', fixed && 'opacity-60 grayscale')}>
          <div className="text-[10px] font-medium text-destructive/80 dark:text-red-400 flex items-center gap-1">
            <span className="size-4 rounded bg-destructive/10 dark:bg-red-500/10 flex items-center justify-center">✕</span>
            修改前
          </div>
          <div className="bg-destructive/5 dark:bg-red-950/20 border border-destructive/10 dark:border-red-500/20 rounded-lg p-2.5 min-h-12">
            <SuggestionValueRenderer value={before} valueType={valueType} variant="before" />
          </div>
        </div>

        {/* After */}
        <div className="space-y-1.5">
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
