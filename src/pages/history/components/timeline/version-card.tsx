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
          'relative isolate flex items-start gap-1 rounded-lg border p-3 transition-colors',
          selected
            ? 'border-transparent'
            : 'border-border/60 bg-background hover:bg-muted/35',
        )}
      >
        {selected && <SelectionHighlight />}
        <motion.button
          type='button'
          data-history-entry={version.id}
          aria-pressed={selected}
          className='flex min-w-0 flex-1 flex-col gap-2.5 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          onClick={() => onSelectEntry(version.id)}
          whileTap={reduceMotion ? undefined : { scale: 0.99 }}
          transition={enter}
        >
          <div className='flex flex-wrap items-center gap-1.5 text-xs'>
            <span
              className={cn(
                'font-semibold tabular-nums',
                selected ? 'text-primary' : 'text-foreground',
              )}
            >
              V{version.version_no}
            </span>
            <span className='text-border'>/</span>
            <span className='flex items-center gap-1 text-muted-foreground'>
              <SourceIcon className='size-3' />
              {sourceMeta.label}
            </span>
            {version.milestone_name && (
              <Flag
                aria-label={`重点版本：${version.milestone_name}`}
                className='size-3 text-primary'
              />
            )}
          </div>
          <div className='min-w-0 w-full'>
            <p className='truncate text-sm font-medium'>
              {getVersionTitle(version)}
            </p>
            {version.description && (
              <p className='mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground'>
                {version.description}
              </p>
            )}
          </div>
          {(version.tags?.length ?? 0) > 0 && (
            <div className='flex flex-wrap gap-1'>
              {version.tags?.slice(0, 2).map((tag) => (
                <Badge
                  key={tag}
                  variant='secondary'
                  className='max-w-28 truncate text-xs font-normal'
                >
                  {tag}
                </Badge>
              ))}
              {(version.tags?.length ?? 0) > 2 && (
                <span className='text-xs text-muted-foreground'>
                  +{(version.tags?.length ?? 0) - 2}
                </span>
              )}
            </div>
          )}
          <time
            dateTime={version.created_at}
            title={formatDateTime(version.created_at)}
            className='text-xs text-muted-foreground'
          >
            {formatRelativeTime(version.created_at)}
          </time>
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
