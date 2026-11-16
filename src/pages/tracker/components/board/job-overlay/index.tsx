import type { JobApplication } from '../../../types'
import { motion } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION, EASE } from '@/lib/motion'
import { ColumnCard } from '../column-card'

export function JobOverlay({
  job,
  settling,
}: {
  job: JobApplication
  settling: boolean
}) {
  const reduceMotion = useReducedMotion()

  return (
    <div className='relative rounded-lg'>
      <motion.div
        aria-hidden='true'
        initial={false}
        animate={{ opacity: settling ? 0 : 1 }}
        transition={{
          duration: reduceMotion ? 0 : DURATION.base,
          ease: EASE.out,
        }}
        className='pointer-events-none absolute inset-0 rounded-lg shadow-xl ring-1 ring-primary/20'
      />
      <ColumnCard job={job} />
    </div>
  )
}
