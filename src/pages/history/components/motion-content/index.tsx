import type { ReactNode } from 'react'
import { AnimatePresence, motion, useIsPresent } from 'motion/react'
import { cn } from '@/lib/utils'
import { useHistoryMotion } from '../../hooks/use-history-motion'

function ContentPanel({ children }: { children: ReactNode }) {
  const present = useIsPresent()
  const { reduceMotion, enter, exit } = useHistoryMotion()

  return (
    <motion.div
      inert={!present}
      aria-hidden={!present || undefined}
      initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduceMotion ? 0 : -4, transition: exit }}
      transition={enter}
      className='col-start-1 row-start-1 flex min-h-0 min-w-0 flex-col'
      style={{ pointerEvents: present ? undefined : 'none' }}
    >
      {children}
    </motion.div>
  )
}

/** 固定区域内交叉过渡，离场内容不参与交互或无障碍导航。 */
export default function HistoryMotionContent({
  transitionKey,
  children,
  className,
}: {
  transitionKey: string | number
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'relative grid min-h-0 min-w-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)]',
        className,
      )}
    >
      <AnimatePresence initial={false}>
        <ContentPanel key={transitionKey}>{children}</ContentPanel>
      </AnimatePresence>
    </div>
  )
}
