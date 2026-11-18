import type { ComponentProps } from 'react'
import { motion } from 'motion/react'
import { Calendar } from '@/components/ui/calendar'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION, EASE } from '@/lib/motion'

export default function CalendarContent(
  props: ComponentProps<typeof Calendar>,
) {
  const reduced = useReducedMotion()

  return (
    <motion.div
      initial={{ opacity: reduced ? 1 : 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduced ? 0 : DURATION.fast, ease: EASE.out }}
    >
      <Calendar {...props} />
    </motion.div>
  )
}
