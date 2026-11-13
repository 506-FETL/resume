import { Check, ShieldQuestion, X } from 'lucide-react'
import { AnimatePresence, motion, useIsPresent } from 'motion/react'
import { useRef, useState } from 'react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { Button } from '@/components/ui/button'
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from '@/components/ui/trace'
import { DURATION, EASE } from '@/lib/motion'
import useAssistantStore from '../../store'
import { JobChangeSummary } from './job-change-summary'
import { ResumeFieldDiff } from './resume-field-diff'

type PendingConfirm = NonNullable<
  ReturnType<typeof useAssistantStore.getState>['pendingConfirm']
>

function Confirmation({ pending }: { pending: PendingConfirm }) {
  const reduceMotion = useReducedMotion()
  const isPresent = useIsPresent()
  const resolvedRef = useRef(false)
  const [open, setOpen] = useState(true)
  const { preview, resolve } = pending

  const respond = (accepted: boolean, button: HTMLButtonElement) => {
    if (!isPresent || resolvedRef.current) return

    resolvedRef.current = true

    button
      .closest<HTMLElement>('[data-slot=message-scroller-viewport]')
      ?.focus({ preventScroll: true })

    resolve(accepted)
  }

  return (
    <motion.div
      inert={!isPresent}
      aria-hidden={!isPresent || undefined}
      initial={
        reduceMotion ? false : { opacity: 0, transform: 'translateY(8px)' }
      }
      animate={{ opacity: 1, transform: 'translateY(0px)' }}
      exit={{
        opacity: 0,
        transition: {
          duration: reduceMotion ? 0 : DURATION.fast,
          ease: EASE.in,
        },
      }}
      transition={{
        duration: reduceMotion ? 0 : DURATION.base,
        ease: EASE.out,
      }}
      className='min-w-0 rounded-xl border p-3 sm:p-4'
    >
      <Trace>
        <TraceCollapsible open={open} onOpenChange={setOpen}>
          <TraceCollapsibleTrigger className='w-full'>
            <TraceLine className='text-foreground'>
              <TraceIcon>
                <ShieldQuestion />
              </TraceIcon>
              <TraceTitle title={preview.title}>
                等待确认：{preview.title}
              </TraceTitle>
            </TraceLine>
          </TraceCollapsibleTrigger>
          <TraceCollapsibleContent>
            {preview.kind === 'resume-field' ? (
              <ResumeFieldDiff
                sectionKey={preview.sectionKey ?? ''}
                before={preview.before}
                after={preview.after}
              />
            ) : (
              <JobChangeSummary summary={preview.summary ?? ''} />
            )}
          </TraceCollapsibleContent>
        </TraceCollapsible>
      </Trace>
      <div className='mt-3 flex justify-end gap-2'>
        <Button
          variant='ghost'
          size='sm'
          onClick={(event) => respond(false, event.currentTarget)}
        >
          <X className='size-3.5' />
          取消
        </Button>
        <Button
          size='sm'
          onClick={(event) => respond(true, event.currentTarget)}
        >
          <Check className='size-3.5' />
          确认应用
        </Button>
      </div>
    </motion.div>
  )
}

export default function ConfirmCard() {
  const pending = useAssistantStore((state) => state.pendingConfirm)

  // 外层消息行负责退出，避免空的 propagate 列表阻塞父级卸载。
  return (
    <AnimatePresence initial={false} mode='wait'>
      {pending && <Confirmation key={pending.id} pending={pending} />}
    </AnimatePresence>
  )
}
