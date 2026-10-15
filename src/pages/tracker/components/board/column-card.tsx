import type { JobApplication } from '../../types'
import { Bell, Building2, MapPin } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { memo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { DURATION, EASE } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { NEXT_ACTION_TONE_CLASSES } from '../../const'
import useTrackerStore from '../../store'
import { getNextActionBadge } from '../../utils'
import { CompanyLogo } from '../company-logo'

interface ColumnCardProps {
  job: JobApplication
}

export const ColumnCard = memo(({ job }: ColumnCardProps) => {
  const reduceMotion = useReducedMotion()
  const { isSelectMode, isSelected, toggleSelect, openJobDrawer } = useTrackerStore(useShallow(state => ({ isSelectMode: state.isSelectMode, isSelected: state.selectedIds.has(job.id), toggleSelect: state.toggleSelect, openJobDrawer: state.openJobDrawer })))
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
        <div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
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
      {(job.next_action || nextActionBadge) && (
        <div className="flex min-w-0 items-center gap-2 border-t border-border/60 px-3 py-2 text-xs text-muted-foreground">
          <Bell className="size-3 shrink-0" />
          {job.next_action && <span className="min-w-0 flex-1 truncate" title={job.next_action}>{job.next_action}</span>}
          {nextActionBadge && <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[10px]', NEXT_ACTION_TONE_CLASSES[nextActionBadge.tone])}>{nextActionBadge.label}</span>}
        </div>
      )}
    </Card>
  )
})
