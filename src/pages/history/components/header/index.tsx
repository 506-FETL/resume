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

export default function HistoryHeader({ activeResumeId, resumeOptions, loading, error, onResumeChange }: HistoryHeaderProps) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.header
      initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : DURATION.base, ease: EASE.out }}
      className="flex shrink-0 flex-col gap-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <HistoryHeaderSummary />
        <HistoryHeaderActions activeResumeId={activeResumeId} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/20 px-3 py-3 sm:px-4">
        <HistoryResumeSelector
          value={activeResumeId}
          options={resumeOptions}
          loading={loading}
          error={error}
          onChange={onResumeChange}
        />
        <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
          {loading ? '正在加载简历…' : `${resumeOptions.length} 份云端简历`}
        </span>
      </div>
    </motion.header>
  )
}
