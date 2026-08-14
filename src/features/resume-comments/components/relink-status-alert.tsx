import { Link2 } from 'lucide-react'
import { motion, useIsPresent, useReducedMotion } from 'motion/react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { COMMENT_MOTION } from '../const.ts'

export function RelinkStatusAlert({ onCancel }: { onCancel: () => void }) {
  const isPresent = useIsPresent()
  const reduceMotion = useReducedMotion()

  return (
    <div
      data-resume-comment-ui
      className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+1rem)] z-60 flex justify-center px-4"
    >
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: -8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
        transition={{
          duration: reduceMotion ? 0 : COMMENT_MOTION.contentDuration,
          ease: COMMENT_MOTION.ease,
        }}
        aria-hidden={!isPresent}
        className="pointer-events-auto w-full max-w-md"
      >
        <Alert role="status" aria-live="polite" className="bg-background/95 shadow-lg supports-backdrop-filter:backdrop-blur-md">
          <Link2 />
          <AlertTitle>正在重新关联评论</AlertTitle>
          <AlertDescription className="grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <span>请在简历中选择新的文字</span>
            <Button
              size="xs"
              variant="ghost"
              disabled={!isPresent}
              onClick={onCancel}
            >
              取消
            </Button>
          </AlertDescription>
        </Alert>
      </motion.div>
    </div>
  )
}
