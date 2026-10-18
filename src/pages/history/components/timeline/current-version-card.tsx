import type { HistorySelection } from '../../types'
import { ChevronRight, FileText } from 'lucide-react'
import { motion } from 'motion/react'
import { Badge } from '@/components/ui/badge'
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

export default function CurrentVersionCard({ selected, onSelectEntry }: CurrentVersionCardProps) {
  const { reduceMotion, enter } = useHistoryMotion()
  const { currentResume, versions } = useHistoryStore()
  const { latestVersionNo, synced } = getCurrentSyncState(currentResume, versions)

  if (!currentResume)
    return null

  return (
    <motion.button
      type="button"
      data-history-entry="current"
      aria-pressed={selected}
      onClick={() => onSelectEntry('current')}
      className={cn(
        'relative isolate flex w-full min-w-0 items-start gap-3 rounded-lg border border-transparent p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        !selected && 'bg-muted/40 hover:bg-muted/70',
      )}
      whileHover={reduceMotion ? undefined : { y: -1 }}
      whileTap={reduceMotion ? undefined : { scale: 0.99 }}
      transition={enter}
    >
      {selected && <SelectionHighlight />}
      <div className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', selected ? 'bg-primary/10 text-primary' : 'bg-background text-muted-foreground')}>
        <FileText className="size-4" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold">当前内容</span>
          <ChevronRight className={cn('size-3.5 shrink-0', selected ? 'text-primary' : 'text-muted-foreground')} />
        </div>
        <span className="truncate text-xs text-muted-foreground">{currentResume.displayName}</span>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="bg-background text-xs font-normal">
            {versions.length === 0 ? '尚未保存版本' : synced ? `已同步至 V${latestVersionNo}` : '有未保存更新'}
          </Badge>
          {currentResume.updatedAt && (
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(currentResume.updatedAt)}
              更新
            </span>
          )}
        </div>
      </div>
    </motion.button>
  )
}
