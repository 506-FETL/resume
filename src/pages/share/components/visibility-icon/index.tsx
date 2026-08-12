import { Eye, EyeOff } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

export default function VisibilityIcon({ visible }: { visible: boolean }) {
  const reduceMotion = useReducedMotion()

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        data-icon="inline-start"
        key={visible ? 'visible' : 'hidden'}
        initial={reduceMotion ? false : { opacity: 0, rotate: -10, scale: 0.9 }}
        animate={{ opacity: 1, rotate: 0, scale: 1 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, rotate: 10, scale: 0.9 }}
        transition={{ duration: reduceMotion ? 0 : 0.14 }}
      >
        {visible ? <EyeOff /> : <Eye />}
      </motion.span>
    </AnimatePresence>
  )
}
