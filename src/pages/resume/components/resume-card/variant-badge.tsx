import { GitBranch } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { RESUME_BADGE_COLORS } from './const'

export interface VariantBadgeProps {
  parentName: string | null
  jdSnippet: string | null
  matchRate: number | null
  onEdit: () => void
}

export function VariantBadge({
  parentName,
  jdSnippet,
  matchRate,
  onEdit,
}: VariantBadgeProps) {
  const pct = matchRate == null ? null : `${Math.round(matchRate * 100)}%`
  const displayParent = parentName ?? '原简历已删除'
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            asChild
            variant='outline'
            className={cn('shrink-0 gap-1', RESUME_BADGE_COLORS.variant)}
          >
            <button
              type='button'
              onClick={onEdit}
              aria-label={`编辑岗位定制简历，派生自 ${displayParent}${pct ? `，关键词匹配度 ${pct}` : ''}`}
            >
              <GitBranch aria-hidden /> {pct ? `匹配 ${pct}` : '岗位定制'}
            </button>
          </Badge>
        </TooltipTrigger>
        <TooltipContent className='max-w-xs'>
          <div className='flex flex-col gap-1 text-xs'>
            <div>
              派生自：
              <span className='font-medium'>{displayParent}</span>
            </div>
            {jdSnippet && (
              <div className='text-muted-foreground'>
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
