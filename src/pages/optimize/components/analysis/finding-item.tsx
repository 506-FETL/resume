import type { Severity } from '../../types'
import { Check, ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { severityConfig } from '../../const'
import useAtsStore from '../../store'
import IssueFix from './Issue-fix'

interface FindingItemProps {
  id: string
  severity: Severity
}

export default function FindingItem({ id, severity }: FindingItemProps) {
  const { currentAtsConfig } = useAtsStore()

  const finding = currentAtsConfig?.findings?.[severity]?.find(f => f.id === id)

  const config = severityConfig[severity]

  if (!finding)
    return null

  const suggestions = finding.fix.suggestions || []
  const isFixed = suggestions.length > 0 && suggestions.every(s => s.fixed)

  return (
    <Collapsible className={cn(
      'border rounded-xl transition-all duration-300',
      isFixed
        ? 'border-green-500/20 bg-green-500/5 shadow-sm'
        : cn(config.borderColor, 'hover:shadow-sm'),
    )}
    >
      <CollapsibleTrigger className={cn(
        'flex items-center justify-between w-full p-3 sm:p-4 transition-colors rounded-xl',
        !isFixed && 'hover:bg-muted/20',
      )}
      >
        <div className="flex items-center gap-2.5 sm:gap-3 text-left min-w-0 flex-1">
          {isFixed
            ? (
                <div className="shrink-0 text-green-600 bg-green-100 dark:bg-green-900/30 p-1 rounded-full">
                  <Check className="size-3" />
                </div>
              )
            : (
                <div className={cn('shrink-0', config.textColor)}>
                  <config.icon className="size-4" />
                </div>
              )}
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className={cn(
              'font-medium text-xs sm:text-sm leading-snug pr-2 wrap-break-word whitespace-normal',
              isFixed && 'text-muted-foreground line-through decoration-muted-foreground/50',
            )}
            >
              {finding.title}
            </span>
            {isFixed && <span className="text-[10px] text-green-600 font-medium">已修复</span>}
          </div>
        </div>
        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 ml-2 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className={cn(
          'px-3 sm:px-4 pb-3 sm:pb-4 space-y-3',
          !isFixed && config.bgColor,
        )}
        >
          <Separator className="opacity-50" />
          <div className="grid gap-3 text-xs sm:text-sm">
            {/* 问题原因 */}
            <div className="space-y-1.5">
              <span className={cn('font-semibold text-[10px] sm:text-xs uppercase tracking-wide', config.textColor)}>问题描述</span>
              <p className="text-foreground leading-relaxed">{finding.why.summary}</p>
            </div>

            {/* 证据 */}
            {finding.why.evidence.length > 0 && (
              <div className="space-y-1.5">
                <span className={cn('font-semibold text-[10px] sm:text-xs uppercase tracking-wide', config.textColor)}>问题位置</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant="outline" className={cn('text-[10px] sm:text-xs', config.badgeBg, config.badgeText, 'border-transparent')}>
                    {finding.why.evidence[0].locate.sectionLabel}
                  </Badge>
                  {finding.why.evidence[0].locate.itemLabel && (
                    <>
                      <span className={cn('font-medium', config.textColor)}>›</span>
                      <Badge variant="outline" className={cn('text-[10px] sm:text-xs', config.badgeBg, config.badgeText, 'border-transparent')}>
                        {finding.why.evidence[0].locate.itemLabel}
                      </Badge>
                    </>
                  )}
                  {finding.why.evidence[0].locate.fieldLabel && (
                    <>
                      <span className={cn('font-medium', config.textColor)}>›</span>
                      <Badge variant="outline" className={cn('text-[10px] sm:text-xs', config.badgeBg, config.badgeText, 'border-transparent')}>
                        {finding.why.evidence[0].locate.fieldLabel}
                      </Badge>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* 修复建议 */}
            <div className="space-y-1.5">
              <span className={cn('font-semibold text-[10px] sm:text-xs uppercase tracking-wide', config.textColor)}>修复建议</span>
              <p className="text-foreground font-medium leading-relaxed">{finding.fix.summary}</p>

              {/* 修复步骤 */}
              {finding.fix.steps.length > 0 && (
                <ul className="space-y-1.5 pt-1">
                  {finding.fix.steps.map(step => (
                    <li key={step} className="flex items-start gap-2 text-xs text-foreground/80">
                      <span className={cn('size-1.5 rounded-full mt-1.5 shrink-0', config.textColor.replace('text-', 'bg-'))} />
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="pt-1">
              <IssueFix id={id} severity={severity}>
                <Button
                  size="sm"
                  variant={isFixed ? 'outline' : 'default'}
                  className={cn(
                    'h-7 sm:h-8 text-xs font-medium',
                    !isFixed && severity === 'high' && 'bg-red-600 hover:bg-red-700 text-white',
                    !isFixed && severity === 'medium' && 'bg-amber-600 hover:bg-amber-700 text-white',
                    !isFixed && severity === 'low' && 'bg-blue-600 hover:bg-blue-700 text-white',
                    isFixed && 'text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700',
                  )}
                >
                  {isFixed ? '查看详情' : '查看详情 & 自动修复'}
                </Button>
              </IssueFix>
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
