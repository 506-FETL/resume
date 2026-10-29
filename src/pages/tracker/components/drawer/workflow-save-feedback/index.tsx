import type { RefObject } from 'react'
import { useLayoutEffect, useRef } from 'react'
import { Check, CircleAlert, Cloud, Loader2, RotateCcw } from 'lucide-react'
import { AnimatePresence, motion, useIsPresent } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { Button } from '@/components/ui/button'
import { CONTENT_SWITCH } from '@/lib/motion'
import { cn } from '@/lib/utils'

interface WorkflowSaveFeedbackProps {
  status: 'idle' | 'pending' | 'saving' | 'saved' | 'error'
  error?: string | null
  onRetry: () => void
}

const STATUS_LABEL = {
  idle: '自动保存',
  pending: '等待保存',
  saving: '保存中…',
  saved: '已保存',
  error: '保存失败，草稿已保留',
}

function FeedbackState({
  status,
  onRetry,
  returnFocusRef,
}: Pick<WorkflowSaveFeedbackProps, 'status' | 'onRetry'> & {
  returnFocusRef: RefObject<HTMLDivElement | null>
}) {
  const reduce = useReducedMotion()
  const isPresent = useIsPresent()
  const ref = useRef<HTMLDivElement>(null)

  const Icon =
    status === 'saving'
      ? Loader2
      : status === 'saved'
        ? Check
        : status === 'error'
          ? CircleAlert
          : Cloud

  useLayoutEffect(() => {
    const node = ref.current

    if (!node) return

    if (!isPresent && node.contains(document.activeElement)) {
      returnFocusRef.current?.focus({ preventScroll: true })
    }

    node.inert = !isPresent

    if (isPresent) node.removeAttribute('aria-hidden')
    else node.setAttribute('aria-hidden', 'true')
  }, [isPresent, returnFocusRef])

  return (
    <motion.div
      ref={ref}
      className={cn(
        'inline-flex min-h-7 items-center gap-1.5',
        status === 'error' ? 'text-destructive' : 'text-muted-foreground',
      )}
      initial={reduce ? false : { opacity: 0, transform: 'translateY(4px)' }}
      animate={{ opacity: 1, transform: 'translateY(0px)' }}
      exit={{
        opacity: 0,
        transform: 'translateY(0px)',
        transition: {
          ...CONTENT_SWITCH.exit,
          ...(reduce && { duration: 0 }),
        },
      }}
      transition={{
        ...CONTENT_SWITCH.enter,
        ...(reduce && { duration: 0 }),
      }}
    >
      <Icon
        aria-hidden='true'
        className={cn(
          'size-3.5 shrink-0',
          status === 'saving' && !reduce && 'animate-spin',
        )}
      />
      <span aria-hidden='true'>{STATUS_LABEL[status]}</span>
      {status === 'error' && (
        <Button
          variant='ghost'
          size='sm'
          className='h-7 gap-1 px-2 text-xs'
          onClick={() => {
            if (!isPresent) return

            returnFocusRef.current?.focus({ preventScroll: true })
            onRetry()
          }}
        >
          <RotateCcw className='size-3' />
          重试
        </Button>
      )}
    </motion.div>
  )
}

export default function WorkflowSaveFeedback({
  status,
  error,
  onRetry,
}: WorkflowSaveFeedbackProps) {
  const ref = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={ref}
      tabIndex={-1}
      aria-label={STATUS_LABEL[status]}
      className='flex min-h-7 items-center text-xs outline-none'
      title={status === 'error' ? error || undefined : undefined}
    >
      <span role='status' className='sr-only'>
        {STATUS_LABEL[status]}
      </span>
      <AnimatePresence initial={false} mode='wait'>
        <FeedbackState
          key={status}
          status={status}
          onRetry={onRetry}
          returnFocusRef={ref}
        />
      </AnimatePresence>
    </div>
  )
}
