import { Check, Cloud, Loader2, RotateCcw } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { DURATION, EASE } from '@/lib/motion'
import { cn } from '@/lib/utils'

interface WorkflowSaveFeedbackProps {
  status: 'idle' | 'pending' | 'saving' | 'saved' | 'error'
  error?: string | null
  onRetry: () => void
}

export default function WorkflowSaveFeedback({
  status,
  error,
  onRetry,
}: WorkflowSaveFeedbackProps) {
  const reduce = useReducedMotion()

  const label = {
    idle: '自动保存',
    pending: '等待保存',
    saving: '保存中…',
    saved: '已保存',
    error: '保存失败，草稿已保留',
  }[status]

  const Icon =
    status === 'saving' ? Loader2 : status === 'saved' ? Check : Cloud

  return (
    <div
      className={cn(
        'flex min-h-7 items-center gap-1.5 text-xs',
        status === 'error' ? 'text-destructive' : 'text-muted-foreground',
      )}
    >
      <span
        role='status'
        aria-live='polite'
        title={status === 'error' ? error || undefined : undefined}
      >
        <AnimatePresence initial={false} mode='wait'>
          <motion.span
            key={status}
            className='inline-flex items-center gap-1.5'
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: reduce ? 0 : DURATION.fast,
              ease: EASE.out,
            }}
          >
            <Icon
              aria-hidden='true'
              className={cn(
                'size-3.5',
                status === 'saving' && !reduce && 'animate-spin',
              )}
            />
            {label}
          </motion.span>
        </AnimatePresence>
      </span>
      {status === 'error' && (
        <Button
          variant='ghost'
          size='sm'
          className='h-7 gap-1 px-2 text-xs'
          onClick={onRetry}
        >
          <RotateCcw className='size-3' />
          重试
        </Button>
      )}
    </div>
  )
}
