import type { Finding, Severity } from '../../types'
import { AlertCircle, AlertTriangle, ChevronDown, Info } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { severityConfig } from '../../const'

interface FindingItemProps {
  finding: Finding
  severity: Severity
}

export default function FindingItem({ finding, severity }: FindingItemProps) {
  const config = severityConfig[severity]

  return (
    <Collapsible className={cn(
      'border rounded-xl transition-all',
      config.borderColor,
    )}
    >
      <CollapsibleTrigger className={cn(
        'flex items-center justify-between w-full p-3 sm:p-4 transition-colors',
        'hover:bg-muted/20',
      )}
      >
        <div className="flex items-center gap-2.5 sm:gap-3 text-left min-w-0 flex-1">
          <div className={cn('shrink-0', config.textColor)}>
            {severity === 'high' && <AlertCircle className="size-4" />}
            {severity === 'medium' && <AlertTriangle className="size-4" />}
            {severity === 'low' && <Info className="size-4" />}
          </div>
          <span className="font-medium text-xs sm:text-sm leading-snug">{finding.title}</span>
        </div>
        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 ml-2 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className={cn(
          'px-3 sm:px-4 pb-3 sm:pb-4 space-y-3',
          config.bgColor,
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
              <Button
                size="sm"
                className={cn(
                  'h-7 sm:h-8 text-xs font-medium',
                  severity === 'high' && 'bg-red-600 hover:bg-red-700 text-white',
                  severity === 'medium' && 'bg-amber-600 hover:bg-amber-700 text-white',
                  severity === 'low' && 'bg-blue-600 hover:bg-blue-700 text-white',
                )}
              >
                查看详情 & 自动修复
              </Button>
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
