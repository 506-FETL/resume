import { GitBranch } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export interface VariantBadgeProps {
  parentName: string | null
  jdSnippet: string | null
  matchRate: number | null
}

export function VariantBadge({ parentName, jdSnippet, matchRate }: VariantBadgeProps) {
  const pct = matchRate == null ? null : `${Math.round(matchRate * 100)}%`
  const displayParent = parentName ?? '原简历已删除'
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="gap-1" aria-label={`派生自 ${displayParent}`}>
            <GitBranch aria-hidden />
            {' '}
            派生
            {pct ? ` · ${pct}` : ''}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="flex flex-col gap-1 text-xs">
            <div>
              派生自：
              <span className="font-medium">{displayParent}</span>
            </div>
            {jdSnippet && (
              <div className="text-muted-foreground">
                JD：
                {jdSnippet}
              </div>
            )}
            {pct && (
              <div>
                关键词匹配度：
                {pct}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
