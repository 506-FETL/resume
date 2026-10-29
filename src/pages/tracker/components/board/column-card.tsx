import { FocusButton } from '../focus-button'
import type { JobApplication } from '../../types'
import { Bell, Building2 } from 'lucide-react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { memo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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

  const { isSelectMode, isSelected, toggleSelect, openJobDrawer } =
    useTrackerStore(
      useShallow((state) => ({
        isSelectMode: state.isSelectMode,
        isSelected: state.selectedIds.has(job.id),
        toggleSelect: state.toggleSelect,
        openJobDrawer: state.openJobDrawer,
      })),
    )

  const nextActionBadge = getNextActionBadge(job)

  const handleClick = () => {
    if (isSelectMode) toggleSelect(job.id)
    else openJobDrawer(job)
  }

  return (
    <Card
      className={cn(
        'group gap-0 cursor-grab rounded-lg border border-border/70 bg-card p-0 shadow-none ring-0 transition-[background-color,border-color,box-shadow] select-none hover:border-foreground/20 hover:bg-accent/20 active:cursor-grabbing',
        isSelected && 'border-primary bg-primary/5',
        job.archived && 'opacity-60',
      )}
      style={{
        transitionDuration: `${reduceMotion ? 0 : DURATION.base}s`,
        transitionTimingFunction: `cubic-bezier(${EASE.out.join(',')})`,
      }}
      onClick={handleClick}
    >
      <div className='flex items-start gap-2 p-2.5'>
        <div className='pointer-events-none mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground'>
          <CompanyLogo
            logo={job.company_logo}
            company={job.company}
            icon={Building2}
          />
        </div>
        <div className='min-w-0 flex-1'>
          <Button
            type='button'
            variant='ghost'
            onClick={(event) => {
              event.stopPropagation()
              handleClick()
            }}
            // 指针交给整张卡片开始拖动；按钮仍接收 Tab、Enter 和空格。
            className='pointer-events-none block h-auto w-full rounded-sm border-0 p-0 text-left text-sm leading-5 font-semibold whitespace-normal text-foreground hover:bg-transparent'
            aria-label={
              isSelectMode
                ? `选择 ${job.position}`
                : `查看 ${job.company} ${job.position}`
            }
          >
            <span className='line-clamp-2 break-words'>{job.position}</span>
          </Button>
          <div className='mt-1 flex min-w-0 items-center gap-1 text-xs leading-4 text-muted-foreground'>
            <span className='min-w-12 flex-1 truncate' title={job.company}>
              {job.company}
            </span>
            {job.location && (
              <>
                <span aria-hidden className='shrink-0'>
                  ·
                </span>
                <span className='max-w-12 truncate' title={job.location}>
                  {job.location}
                </span>
              </>
            )}
            {job.salary && (
              <>
                <span aria-hidden className='shrink-0'>
                  ·
                </span>
                <span className='max-w-16 truncate' title={job.salary}>
                  {job.salary}
                </span>
              </>
            )}
          </div>
        </div>
        <FocusButton job={job} />
        {isSelectMode && (
          <Checkbox
            checked={isSelected}
            aria-label={`选择 ${job.company} ${job.position}`}
            className='mt-0.5 size-4 shrink-0'
            onClick={(e) => e.stopPropagation()}
            onCheckedChange={() => toggleSelect(job.id)}
          />
        )}
      </div>
      {(job.next_action || nextActionBadge) && (
        <div className='flex min-w-0 items-center gap-1.5 border-t border-border/50 px-2.5 py-1.5 text-xs text-muted-foreground'>
          <Bell className='size-3 shrink-0' />
          {job.next_action && (
            <span className='min-w-0 flex-1 truncate' title={job.next_action}>
              {job.next_action}
            </span>
          )}
          {nextActionBadge && (
            <span
              className={cn(
                'shrink-0 rounded px-1.5 py-0.5 text-[10px]',
                NEXT_ACTION_TONE_CLASSES[nextActionBadge.tone],
              )}
            >
              {nextActionBadge.label}
            </span>
          )}
        </div>
      )}
    </Card>
  )
})
