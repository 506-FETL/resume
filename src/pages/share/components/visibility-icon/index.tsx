import { Eye, EyeOff } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { DURATION, EASE } from '@/lib/motion'

export default function VisibilityIcon({ visible }: { visible: boolean }) {
  const reduceMotion = useReducedMotion()

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        aria-hidden="true"
        data-icon="inline-start"
        key={visible ? 'visible' : 'hidden'}
        initial={reduceMotion ? false : { opacity: 0, rotate: -10, scale: 0.9 }}
        animate={{ opacity: 1, rotate: 0, scale: 1 }}
        exit={{
          opacity: 0,
          rotate: reduceMotion ? 0 : 10,
          scale: reduceMotion ? 1 : 0.9,
          transition: { duration: reduceMotion ? 0 : DURATION.fast, ease: EASE.in },
        }}
        transition={{ duration: reduceMotion ? 0 : DURATION.fast, ease: EASE.out }}
      >
        {visible ? <EyeOff /> : <Eye />}
      </motion.span>
    </AnimatePresence>
  )
}
