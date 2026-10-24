import type { HistoryResumeOption } from '../../types'
import { motion, useReducedMotion } from 'motion/react'
import { DURATION, EASE } from '@/lib/motion'
import HistoryHeaderActions from './actions'
import HistoryResumeSelector from './resume-selector'
import HistoryHeaderSummary from './summary'

interface HistoryHeaderProps {
  activeResumeId: string | null
  resumeOptions: HistoryResumeOption[]
  loading: boolean
  error: string | null
  onResumeChange: (resumeId: string) => void
}

export default function HistoryHeader({
  activeResumeId,
  resumeOptions,
  loading,
  error,
  onResumeChange,
}: HistoryHeaderProps) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.header
      initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduceMotion ? 0 : DURATION.base,
        ease: EASE.out,
      }}
      className='grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 @min-[760px]/workspace:grid-cols-[auto_minmax(0,1fr)_auto]'
    >
      <HistoryHeaderSummary />
      <div className='col-start-2 row-start-1 @min-[760px]/workspace:col-start-3'>
        <HistoryHeaderActions activeResumeId={activeResumeId} />
      </div>

      <div className='col-span-2 min-w-0 @min-[760px]/workspace:col-span-1 @min-[760px]/workspace:col-start-2 @min-[760px]/workspace:row-start-1 @min-[760px]/workspace:max-w-md'>
        <HistoryResumeSelector
          value={activeResumeId}
          options={resumeOptions}
          loading={loading}
          error={error}
          onChange={onResumeChange}
        />
      </div>
    </motion.header>
  )
}
