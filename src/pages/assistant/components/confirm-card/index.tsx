import { Check, ShieldQuestion, X } from 'lucide-react'
import { AnimatePresence, motion, useIsPresent } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { Button } from '@/components/ui/button'
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
  const { preview, resolve } = pending

  return (
    <motion.div
      inert={!isPresent}
      aria-hidden={!isPresent || undefined}
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{
        opacity: 0,
        y: 0,
        transition: {
          duration: reduceMotion ? 0 : DURATION.fast,
          ease: EASE.in,
        },
      }}
      transition={{
        duration: reduceMotion ? 0 : DURATION.base,
        ease: EASE.out,
      }}
      className='overflow-hidden rounded-xl border bg-card shadow-sm'
    >
      <div className='flex items-center gap-2 border-b bg-muted/40 px-4 py-2.5'>
        <span className='flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary'>
          <ShieldQuestion className='size-3.5' />
        </span>
        <div className='min-w-0'>
          <p className='text-xs font-medium text-muted-foreground'>
            待确认操作
          </p>
        </div>
      </div>
      <div className='px-4 py-3'>
        <p className='mb-3 text-sm font-medium text-foreground'>
          {preview.title}
        </p>
        {preview.kind === 'resume-field' ? (
          <ResumeFieldDiff
            sectionKey={preview.sectionKey ?? ''}
            before={preview.before}
            after={preview.after}
          />
        ) : (
          <JobChangeSummary summary={preview.summary ?? ''} />
        )}
      </div>
      <div className='flex justify-end gap-2 border-t bg-muted/20 px-4 py-2.5'>
        <Button variant='ghost' size='sm' onClick={() => resolve(false)}>
          <X className='size-3.5' />
          取消
        </Button>
        <Button size='sm' onClick={() => resolve(true)}>
          <Check className='size-3.5' />
          确认应用
        </Button>
      </div>
    </motion.div>
  )
}

export default function ConfirmCard() {
  const pending = useAssistantStore((s) => s.pendingConfirm)

  return (
    <AnimatePresence initial={false} mode='wait'>
      {pending && <Confirmation key={pending.id} pending={pending} />}
    </AnimatePresence>
  )
}
