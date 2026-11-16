import { GitBranch } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { RESUME_BADGE_COLORS } from './const'

export interface VariantBadgeProps {
  parentName: string | null
  matchRate: number | null
  onEdit: () => void
}

export function VariantBadge({
  parentName,
  matchRate,
  onEdit,
}: VariantBadgeProps) {
  const pct = matchRate == null ? null : `${Math.round(matchRate * 100)}%`
  const displayParent = parentName ?? '原简历已删除'

  return (
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
  )
}
