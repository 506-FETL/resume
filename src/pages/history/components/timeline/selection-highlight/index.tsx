import { motion } from 'motion/react'
import { useHistoryMotion } from '../../../hooks/use-history-motion'

export default function SelectionHighlight() {
  const { reduceMotion, layout } = useHistoryMotion()
  return (
    <motion.span
      aria-hidden
      layoutId={reduceMotion ? undefined : 'history-version-selection'}
      transition={layout}
      className='pointer-events-none absolute inset-0 -z-10 rounded-[inherit] border border-primary/25 bg-primary/5'
    />
  )
}
