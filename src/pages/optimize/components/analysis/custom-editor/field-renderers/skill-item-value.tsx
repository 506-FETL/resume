import type { FieldRendererProps } from './types'
import type { SkillItem } from '@/lib/schema/resume/form/skillSpecialty'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { PROFICIENCY_MAP } from '@/pages/optimize/const'

export function SkillItemValue({ value, variant }: FieldRendererProps<SkillItem>) {
  const percentage = PROFICIENCY_MAP[value.proficiencyLevel] || 50

  return (
    <div className={cn(
      'flex items-center gap-2 p-2 rounded-md border',
      variant === 'before' && 'bg-muted/30 border-border/50',
      variant === 'after' && 'bg-primary/5 border-primary/20',
    )}
    >
      <Badge
        variant="secondary"
        className={cn(
          'shrink-0 text-[10px] px-1.5',
          variant === 'after' && 'bg-primary/10 text-primary',
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
                  className="h-1.5 flex-1"
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
