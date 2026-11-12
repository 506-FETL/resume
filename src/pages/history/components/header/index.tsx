import type { HistoryResumeOption } from '../../types'
import { motion } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
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
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduceMotion ? 0 : DURATION.base,
        ease: EASE.out,
      }}
      className='grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 @min-[760px]/workspace:grid-cols-[auto_minmax(0,1fr)_auto] [@media(max-height:500px)]:grid-cols-[minmax(0,1fr)_auto] [@media(max-height:500px)]:gap-2'
    >
      <div className='min-w-0 [@media(max-height:500px)]:sr-only'>
        <HistoryHeaderSummary />
      </div>
      <div className='col-start-2 row-start-1 @min-[760px]/workspace:col-start-3 [@media(max-height:500px)]:col-start-2'>
        <HistoryHeaderActions activeResumeId={activeResumeId} />
      </div>

      <div className='col-span-2 min-w-0 @min-[760px]/workspace:col-span-1 @min-[760px]/workspace:col-start-2 @min-[760px]/workspace:row-start-1 @min-[760px]/workspace:max-w-md [@media(max-height:500px)]:col-span-1 [@media(max-height:500px)]:col-start-1 [@media(max-height:500px)]:row-start-1'>
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
