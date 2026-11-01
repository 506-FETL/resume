import { useRef, useState } from 'react'
import {
  ChevronDown,
  History,
  ListChecks,
  Share2,
  WandSparkles,
} from 'lucide-react'
import {
  assertTrackerAccountScope,
  getTrackerAccountScope,
} from '../../../lib/account-scope'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Spinner } from '@/components/ui/spinner'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION, EASE } from '@/lib/motion'
import { jobContextUrl } from '@/lib/job-context'
import useTrackerStore from '../../../store'

export default function PreparationActions() {
  const job = useTrackerStore((state) => state.selectedJob)
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const busy = pendingAction !== null
  const toolbarRef = useRef<HTMLDivElement>(null)

  if (!job) return null

  const open = async (path: string, action?: string) => {
    if (busy) return

    const scope = getTrackerAccountScope()

    setPendingAction(action ?? path)

    try {
      await useTrackerStore.getState().flushWorkflow(job.id)
      assertTrackerAccountScope(scope)

      const latest = useTrackerStore.getState().selectedJob

      if (latest?.id !== job.id) return
      if (action === 'customize' && !latest.jd_text?.trim()) {
        toast.info('请先在岗位详情中补充 JD 原文')

        return
      }

      navigate(
        jobContextUrl(
          latest.resume_id ? path : '/resume',
          latest.id,
          action ? { action } : {},
        ),
      )
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : '岗位尚未保存，请重试',
      )
    } finally {
      setPendingAction(null)
    }
  }

  return (
    <div
      ref={toolbarRef}
      tabIndex={-1}
      className='flex flex-wrap items-center gap-2 outline-none'
    >
      <Button disabled={busy} size='sm' onClick={() => open('/resume/editor')}>
        {pendingAction === '/resume/editor' && (
          <Spinner
            aria-hidden
            className={reduce ? 'animate-none' : undefined}
          />
        )}
        {job.resume_id ? '继续编辑' : '选择或创建简历'}
      </Button>
      <Button
        disabled={busy}
        size='sm'
        variant='outline'
        onClick={() => open('/resume', 'customize')}
      >
        {pendingAction === 'customize' && (
          <Spinner
            aria-hidden
            className={reduce ? 'animate-none' : undefined}
          />
        )}
        岗位定制
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button disabled={busy} size='sm' variant='ghost'>
            {busy &&
              pendingAction !== '/resume/editor' &&
              pendingAction !== 'customize' && (
                <Spinner
                  aria-hidden
                  className={reduce ? 'animate-none' : undefined}
                />
              )}
            更多操作
            <ChevronDown className='size-3.5' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align='end'
          onCloseAutoFocus={(event) => {
            if (!busy) return

            event.preventDefault()
            toolbarRef.current?.focus({ preventScroll: true })
          }}
          style={{
            animationDuration: `${reduce ? 0 : DURATION.fast}s`,
            animationTimingFunction: `cubic-bezier(${EASE.out.join(',')})`,
          }}
        >
          <DropdownMenuItem onSelect={() => open('/optimize')}>
            <WandSparkles className='size-4' />
            简历优化
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => open('/resume/editor', 'experience')}
          >
            <ListChecks className='size-4' />
            相关经历
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => open('/history')}>
            <History className='size-4' />
            历史版本
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => open('/resume', 'share')}>
            <Share2 className='size-4' />
            分享简历
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
