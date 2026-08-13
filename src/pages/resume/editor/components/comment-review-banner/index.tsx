import { Clock3, LoaderCircle } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { Button } from '@/components/ui/button'

export function CommentReviewBanner({
  sourceLabel,
  switching,
  onReturn,
}: {
  sourceLabel: string
  switching: boolean
  onReturn: () => void
}) {
  const reduceMotion = useReducedMotion()

  return (
    <div className="pointer-events-none z-20 flex shrink-0 justify-center border-b bg-muted/30 px-3 py-2">
      <motion.div
        data-resume-comment-ui
        role="status"
        initial={reduceMotion ? false : { opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
        transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="pointer-events-auto flex max-w-full items-center gap-2 rounded-xl border bg-background px-2.5 py-2 shadow-md"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
          <Clock3 className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium sm:text-sm">
            正在查看
            {' '}
            {sourceLabel}
            {' '}
            的评论
          </span>
          <span className="block truncate text-[11px] text-muted-foreground sm:text-xs">
            历史版本只读，返回当前版本后可继续编辑
          </span>
        </span>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="shrink-0"
          disabled={switching}
          onClick={onReturn}
        >
          {switching ? <LoaderCircle className="animate-spin" /> : null}
          <span className="hidden sm:inline">返回当前版本</span>
          <span className="sm:hidden">返回</span>
        </Button>
      </motion.div>
    </div>
  )
}
