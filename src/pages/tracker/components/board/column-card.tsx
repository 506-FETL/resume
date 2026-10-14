import type { JobApplication } from '../../types'
import { Bell, Building2, Link2, MapPin } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { DURATION, EASE } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { NEXT_ACTION_TONE_CLASSES } from '../../const'
import useTrackerStore from '../../store'
import { getDaysInStage, getNextActionBadge, getTrackerMetaSummary } from '../../utils'
import { CompanyLogo } from '../company-logo'

interface ColumnCardProps {
  job: JobApplication
}

export function ColumnCard({ job }: ColumnCardProps) {
  const reduceMotion = useReducedMotion()
  const { isSelectMode, selectedIds, toggleSelect, openJobDrawer } = useTrackerStore()
  const isSelected = selectedIds.has(job.id)
  const meta = getTrackerMetaSummary(job)
  const daysInStage = getDaysInStage(job)
  const nextActionBadge = getNextActionBadge(job)

  const handleClick = () => {
    if (isSelectMode)
      toggleSelect(job.id)
    else openJobDrawer(job)
  }

  return (
    <Card
      className={cn(
        'group gap-0 cursor-pointer rounded-xl border-border/70 bg-card p-0 shadow-xs transition-[background-color,box-shadow,transform] hover:shadow-sm',
        !reduceMotion && 'hover:-translate-y-0.5',
        isSelected && 'border-primary bg-primary/5',
        job.archived && 'opacity-60',
      )}
      style={{ transitionDuration: `${reduceMotion ? 0 : DURATION.fast}s`, transitionTimingFunction: `cubic-bezier(${EASE.out.join(',')})` }}
      onClick={handleClick}
    >
      <div className="p-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <CompanyLogo logo={job.company_logo} company={job.company} icon={Building2} />
          </div>
          <p className="min-w-0 flex-1 truncate text-xs font-medium text-muted-foreground">{job.company}</p>
          {isSelectMode && (
            <Checkbox
              checked={isSelected}
              aria-label={`选择 ${job.company} ${job.position}`}
              className="size-4"
              onClick={e => e.stopPropagation()}
              onCheckedChange={() => toggleSelect(job.id)}
            />
          )}
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            handleClick()
          }}
          className="mt-2 block w-full rounded-sm text-left text-sm font-semibold leading-5 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={isSelectMode ? `选择 ${job.position}` : `查看 ${job.company} ${job.position}`}
        >
          <span className="line-clamp-2 break-words">{job.position}</span>
        </button>
        <div className="mt-2 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="size-3 shrink-0" />
          <span className="min-w-0 truncate">{job.location || '地点未填写'}</span>
          {job.salary && (
            <>
              <span className="text-border">·</span>
              <span className="truncate">{job.salary}</span>
            </>
          )}
        </div>
      </div>
      <div className="border-t border-border/60 px-3 py-2.5">
        <p className="text-[10px] font-medium text-muted-foreground">下一步跟进</p>
        <p className={cn('mt-1 line-clamp-2 break-words text-xs leading-5', !job.next_action && 'text-muted-foreground')}>{job.next_action || '未设置下一步'}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {job.archived && (
            <span className="rounded-full border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">已归档</span>
          )}
          {nextActionBadge && (
            <span className={cn('inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium', NEXT_ACTION_TONE_CLASSES[nextActionBadge.tone])}>
              <Bell className="size-2.5" />
              {nextActionBadge.label}
            </span>
          )}
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {daysInStage === 0 ? '今天更新' : `${daysInStage} 天未更新`}
          </span>
          {meta.activeSubStageLabel && (
            <span className="rounded-full bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
              {meta.activeSubStageLabel}
            </span>
          )}
          {meta.hasJobUrl && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              <Link2 className="size-2.5" />
              JD
            </span>
          )}
        </div>
      </div>
    </Card>
  )
}
