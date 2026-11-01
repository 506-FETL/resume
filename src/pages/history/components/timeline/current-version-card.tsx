import type { HistorySelection } from '../../types'
import { ChevronRight, FileText } from 'lucide-react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'
import { formatRelativeTime } from '@/utils/date'
import { useHistoryMotion } from '../../hooks/use-history-motion'
import useHistoryStore from '../../store'
import { getCurrentSyncState } from '../../utils'
import SelectionHighlight from './selection-highlight'

interface CurrentVersionCardProps {
  selected: boolean
  onSelectEntry: (target: HistorySelection) => void
}

export default function CurrentVersionCard({
  selected,
  onSelectEntry,
}: CurrentVersionCardProps) {
  const { reduceMotion, enter } = useHistoryMotion()
  const { currentResume, versions } = useHistoryStore()

  const { latestVersionNo, synced } = getCurrentSyncState(
    currentResume,
    versions,
  )

  if (!currentResume) return null

  return (
    <motion.button
      type='button'
      data-history-entry='current'
      aria-pressed={selected}
      onClick={() => onSelectEntry('current')}
      className={cn(
        'relative isolate flex w-full min-w-0 items-start gap-2 rounded-lg p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        !selected && 'hover:bg-muted/35',
      )}
      whileHover={reduceMotion ? undefined : { y: -1 }}
      whileTap={reduceMotion ? undefined : { scale: 0.99 }}
      transition={enter}
    >
      {selected && <SelectionHighlight />}
      <FileText
        className={cn(
          'mt-0.5 size-4 shrink-0',
          selected ? 'text-primary' : 'text-muted-foreground',
        )}
      />
      <div className='flex min-w-0 flex-1 flex-col gap-1'>
        <div className='flex items-center justify-between gap-2'>
          <span className='text-sm font-semibold'>当前内容</span>
          <ChevronRight
            className={cn(
              'size-3.5 shrink-0',
              selected ? 'text-primary' : 'text-muted-foreground',
            )}
          />
        </div>
        <div className='flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs leading-5 text-muted-foreground'>
          <span>
            {versions.length === 0
              ? '尚未保存版本'
              : synced
                ? `已同步至 V${latestVersionNo}`
                : '有未保存更新'}
          </span>
          {currentResume.updatedAt && (
            <time dateTime={currentResume.updatedAt}>
              {formatRelativeTime(currentResume.updatedAt)}
              更新
            </time>
          )}
        </div>
      </div>
    </motion.button>
  )
}
