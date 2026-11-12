import { PaperSkeleton } from '@/components/loading-skeleton'
import { motion } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { Button } from '@/components/ui/button'
import { DURATION, EASE } from '@/lib/motion'

export default function TemplateResourceStatus({
  error,
  onRetry,
}: {
  error?: string
  onRetry?: () => void
}) {
  const reduced = useReducedMotion()

  if (!error) return <PaperSkeleton label='正在准备简历预览' />

  return (
    <motion.div
      initial={{ opacity: 0, y: reduced ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : DURATION.base, ease: EASE.out }}
      className='flex min-h-40 flex-col items-center justify-center gap-3 p-6 text-sm text-muted-foreground'
      role='alert'
    >
      <p>{error}</p>
      {onRetry && (
        <Button variant='outline' size='sm' onClick={onRetry}>
          重试
        </Button>
      )}
    </motion.div>
  )
}
