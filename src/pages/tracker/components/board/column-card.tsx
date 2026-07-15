import type { JobApplication } from '../../types'
import { Building2, Link2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import useTrackerStore from '../../store'
import { getTrackerMetaSummary } from '../../utils'

interface ColumnCardProps {
  job: JobApplication
}

export function ColumnCard({ job }: ColumnCardProps) {
  const { isSelectMode, selectedIds, toggleSelect, openJobDrawer } = useTrackerStore()
  const isSelected = selectedIds.has(job.id)
  const meta = getTrackerMetaSummary(job)

  const handleClick = () => {
    if (isSelectMode)
      toggleSelect(job.id)
    else openJobDrawer(job)
  }

  return (
    <Card
      className={cn(
        'cursor-pointer rounded-lg border bg-card p-3 shadow-xs transition-colors hover:bg-muted/40',
        isSelected && 'border-primary bg-primary/5',
      )}
      onClick={handleClick}
    >
      <div className="flex items-start gap-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          {job.company_logo
            ? <img src={job.company_logo} alt={job.company} className="size-5 object-contain" />
            : <Building2 className="size-4" />}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="truncate text-sm font-medium leading-tight text-foreground">{job.position}</p>
          <p className="truncate text-xs text-muted-foreground">{job.company}</p>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="truncate">{job.location || '—'}</span>
            {job.salary && (
              <>
                <span className="text-border">·</span>
                <span className="truncate">{job.salary}</span>
              </>
            )}
          </div>
          {(meta.activeSubStageLabel || meta.hasJobUrl) && (
            <div className="flex flex-wrap items-center gap-1 pt-0.5">
              {meta.activeSubStageLabel && (
                <span className="rounded-full bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">
                  {meta.activeSubStageLabel}
                </span>
              )}
              {meta.hasJobUrl && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">
                  <Link2 className="size-2.5" />
                  JD
                </span>
              )}
            </div>
          )}
        </div>
        {isSelectMode && (
          <Checkbox
            checked={isSelected}
            className="mt-0.5 size-4"
            onClick={e => e.stopPropagation()}
            onCheckedChange={() => toggleSelect(job.id)}
          />
        )}
      </div>
    </Card>
  )
}
