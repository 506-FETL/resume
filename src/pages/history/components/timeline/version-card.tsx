import type { HistorySelection, RestoreStrategy } from '../../types'
import type { ResumeHistoryVersionListItem } from '@/lib/supabase/resume/history'
import { Eye, Flag, MoreHorizontal, RotateCcw, Trash2 } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { formatDateTime, formatRelativeTime } from '@/utils/date'
import { SOURCE_META } from '../../const'
import { useHistoryMotion } from '../../hooks/use-history-motion'
import useHistoryStore from '../../store'
import { getVersionTitle } from '../../utils'
import HistoryDialogs from '../dialogs'
import SelectionHighlight from './selection-highlight'

interface VersionCardProps {
  version: ResumeHistoryVersionListItem
  selected: boolean
  onSelectEntry: (target: HistorySelection) => void
}

export default function VersionCard({
  version,
  selected,
  onSelectEntry,
}: VersionCardProps) {
  const { reduceMotion, enter, surfaceProps } = useHistoryMotion()
  const { restoreVersion, deleteVersion } = useHistoryStore()
  const [restoreTargetId, setRestoreTargetId] = useState<number | null>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)
  const sourceMeta = SOURCE_META[version.source_type]
  const SourceIcon = sourceMeta.icon

  const handleConfirmRestore = async (strategy: RestoreStrategy) => {
    const restoredVersion = await restoreVersion(version.id, strategy)

    if (!restoredVersion) return

    setRestoreTargetId(null)
    onSelectEntry(restoredVersion.id)
  }

  const handleConfirmDelete = async () => {
    if (await deleteVersion(version.id)) setDeleteTargetId(null)
  }

  return (
    <>
      <motion.article
        whileHover={reduceMotion ? undefined : { y: -1 }}
        transition={enter}
        className={cn(
          'relative isolate flex min-w-0 items-start gap-1 rounded-lg p-2.5 transition-colors',
          !selected && 'hover:bg-muted/35',
        )}
      >
        {selected && <SelectionHighlight />}
        <motion.button
          type='button'
          data-history-entry={version.id}
          aria-pressed={selected}
          className='flex min-w-0 flex-1 flex-col gap-1 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          onClick={() => onSelectEntry(version.id)}
          whileTap={reduceMotion ? undefined : { scale: 0.99 }}
          transition={enter}
        >
          <div className='flex w-full min-w-0 items-center gap-1.5'>
            <p className='min-w-0 truncate text-sm font-semibold'>
              {getVersionTitle(version)}
            </p>
            {version.milestone_name && (
              <Flag
                aria-label={`重点版本：${version.milestone_name}`}
                className='size-3 shrink-0 text-primary'
              />
            )}
          </div>
          <div className='flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs leading-5 text-muted-foreground'>
            <span className={cn('tabular-nums', selected && 'text-primary')}>
              V{version.version_no}
            </span>
            <span className='flex items-center gap-1'>
              <SourceIcon className='size-3' />
              {sourceMeta.label}
            </span>
            <time
              dateTime={version.created_at}
              title={formatDateTime(version.created_at)}
            >
              {formatRelativeTime(version.created_at)}
            </time>
          </div>
          {version.description && (
            <p className='w-full truncate text-xs leading-5 text-muted-foreground'>
              {version.description}
            </p>
          )}
          {(version.tags?.length ?? 0) > 0 && (
            <div className='flex w-full min-w-0 items-center gap-1 pt-0.5'>
              {version.tags?.slice(0, 2).map((tag) => (
                <Badge
                  key={tag}
                  variant='secondary'
                  className='min-w-0 max-w-24 shrink px-1.5 text-xs font-normal'
                >
                  <span className='truncate'>{tag}</span>
                </Badge>
              ))}
              {(version.tags?.length ?? 0) > 2 && (
                <span className='shrink-0 text-xs text-muted-foreground'>
                  +{(version.tags?.length ?? 0) - 2}
                </span>
              )}
            </div>
          )}
        </motion.button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant='ghost'
              size='icon-sm'
              className='-mr-1 -mt-1 shrink-0 text-muted-foreground'
              aria-label={`版本 V${version.version_no} 的更多操作`}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            {...surfaceProps}
            className={`${surfaceProps.className} history-popup-motion`}
            align='end'
          >
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => onSelectEntry(version.id)}>
                <Eye />
                查看简历
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => setRestoreTargetId(version.id)}>
                <RotateCcw />
                恢复此版本
              </DropdownMenuItem>
              <DropdownMenuItem
                variant='destructive'
                onClick={() => setDeleteTargetId(version.id)}
              >
                <Trash2 />
                删除版本
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </motion.article>
      <HistoryDialogs
        restoreTargetId={restoreTargetId}
        deleteTargetId={deleteTargetId}
        onCloseRestore={() => setRestoreTargetId(null)}
        onConfirmRestore={handleConfirmRestore}
        onCloseDelete={() => setDeleteTargetId(null)}
        onConfirmDelete={handleConfirmDelete}
      />
    </>
  )
}
