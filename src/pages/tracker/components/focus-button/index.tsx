import type { JobApplication } from '../../types'
import { Flag } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { DURATION, EASE } from '@/lib/motion'
import { cn } from '@/lib/utils'
import {
  getTrackerAccountScope,
  isTrackerAccountScopeCurrent,
} from '../../lib/account-scope'
import useTrackerStore from '../../store'
import { getTrackerErrorMessage } from '../../utils'

export function FocusButton({
  job,
}: {
  job: Pick<JobApplication, 'id' | 'position' | 'focused_at'>
}) {
  const reduce = useReducedMotion()
  const focused = Boolean(job.focused_at)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type='button'
          variant='ghost'
          size='icon-sm'
          className={cn(
            'shrink-0 cursor-pointer [@media(pointer:coarse)]:size-11',
            focused
              ? 'text-red-600 hover:text-red-600 dark:text-red-400 dark:hover:text-red-400'
              : 'text-muted-foreground',
          )}
          aria-label={`${job.position}`}
          aria-pressed={focused}
          style={{
            transitionDuration: `${reduce ? 0 : DURATION.fast}s`,
            transitionTimingFunction: `cubic-bezier(${EASE.out.join(',')})`,
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()

            const scope = getTrackerAccountScope()
            const state = useTrackerStore.getState()

            if (focused && state.focusedOnly && !state.drawerOpen)
              document
                .getElementById('tracker-focus-filter')
                ?.focus({ preventScroll: true })

            useTrackerStore
              .getState()
              .toggleJobFocus(job.id, !focused)
              .catch((error) => {
                if (isTrackerAccountScopeCurrent(scope))
                  toast.error('关注标记保存失败', {
                    description: getTrackerErrorMessage(error),
                  })
              })
          }}
        >
          <Flag
            aria-hidden
            className='size-4'
            fill={focused ? 'currentColor' : 'none'}
          />
        </Button>
      </TooltipTrigger>
    </Tooltip>
  )
}
