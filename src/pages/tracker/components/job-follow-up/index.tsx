import type { JobApplication } from '../../types'
import { Bell } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NEXT_ACTION_TONE_CLASSES } from '../../const'
import { getNextActionBadge } from '../../utils'

export function JobFollowUp({ job }: { job: JobApplication }) {
  const badge = getNextActionBadge(job)

  if (!job.next_action && !badge) return null

  return (
    <div className='mt-2.5 mr-1 ml-12 flex min-w-0 items-start gap-2'>
      <Bell
        aria-hidden
        className='mt-0.5 size-3.5 shrink-0 text-muted-foreground'
      />
      <div className='flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-1.5'>
        {job.next_action && (
          <span className='min-w-0 flex-[1_1_9rem] break-words text-sm leading-5 text-foreground/85'>
            {job.next_action}
          </span>
        )}
        {badge && (
          <span
            className={cn(
              'shrink-0 rounded-md px-1.5 py-0.5 text-xs leading-4',
              NEXT_ACTION_TONE_CLASSES[badge.tone],
            )}
          >
            {badge.tone === 'today' ? '今天跟进' : badge.label}
          </span>
        )}
      </div>
    </div>
  )
}
