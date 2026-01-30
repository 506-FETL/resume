import type { JobApplication } from '../types'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

interface ColumnCardProps {
  job: JobApplication
  isSelectMode?: boolean
  isSelected?: boolean
  onClick?: () => void
  onToggleSelect?: (id: string) => void
}
export function ColumnCard({ job, onClick, isSelectMode, isSelected, onToggleSelect }: ColumnCardProps) {
  return (
    <Card
      className={cn(
        'p-3 cursor-pointer',
        isSelected && 'border-primary bg-primary/5',
      )}
      onClick={onClick}
    >
      {/* 直接在 Card 内部放内容，不要再嵌套 div */}
      <div className="flex items-center gap-2">
        {/* Logo */}
        <div className="size-8 rounded bg-muted flex items-center justify-center shrink-0">
          {job.company_logo
            ? (
                <img src={job.company_logo} alt={job.company} className="size-5 object-contain" />
              )
            : (
                <span className="text-xs font-bold">{job.company[0]}</span>
              )}
        </div>

        {/* 职位信息 */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{job.position}</p>
          <p className="text-xs text-muted-foreground truncate">
            {job.company}
            {' '}
            •
            {job.location}
          </p>
        </div>
        {isSelectMode && (
          <Checkbox
            checked={isSelected}
            className="ml-auto size-5"
            onClick={e => e.stopPropagation()}
            onCheckedChange={() => onToggleSelect?.(job.id)}
          />
        )}
      </div>
    </Card>
  )
}
