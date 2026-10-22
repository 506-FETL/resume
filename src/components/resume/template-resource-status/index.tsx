import { LoaderCircle } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { DURATION, EASE } from '@/lib/motion'

export default function TemplateResourceStatus({ error, onRetry }: { error?: string, onRetry?: () => void }) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      key={error ? 'error' : 'loading'}
      initial={{ opacity: 0, y: reduced ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : DURATION.base, ease: EASE.out }}
      className="flex min-h-40 flex-col items-center justify-center gap-3 p-6 text-sm text-muted-foreground"
      role={error ? 'alert' : 'status'}
    >
      {!error && <LoaderCircle className={reduced ? 'size-5' : 'size-5 animate-spin'} aria-hidden />}
      <p>{error ?? '正在准备简历预览…'}</p>
      {error && onRetry && <Button variant="outline" size="sm" onClick={onRetry}>重试</Button>}
    </motion.div>
  )
}
