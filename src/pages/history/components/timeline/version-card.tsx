import type { HistorySelection, RestoreStrategy } from '../../types'
import type { ResumeHistoryVersionListItem } from '@/lib/supabase/resume/history'
import { Eye, Flag, MoreHorizontal, RotateCcw, Trash2 } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { formatDateTime, formatRelativeTime } from '@/utils/date'
import { SOURCE_META } from '../../const'
import useHistoryStore from '../../store'
import { getVersionSubtitle, getVersionTitle } from '../../utils'
import HistoryDialogs from '../dialogs'

interface VersionCardProps {
  version: ResumeHistoryVersionListItem
  index: number
  selected: boolean
  onSelectEntry: (target: HistorySelection) => void
}

export default function VersionCard({
  version,
  index,
  selected,
  onSelectEntry,
}: VersionCardProps) {
  const isMobile = useIsMobile()
  const { restoreVersion, deleteVersion } = useHistoryStore()
  const [restoreTargetId, setRestoreTargetId] = useState<number | null>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)

  const sourceMeta = SOURCE_META[version.source_type]
  const SourceIcon = sourceMeta.icon
  const showSelectedState = selected && !isMobile

  const handleConfirmRestore = async (strategy: RestoreStrategy) => {
    const restoredVersion = await restoreVersion(version.id, strategy)

    if (!restoredVersion) {
      return
    }

    setRestoreTargetId(null)
    onSelectEntry(restoredVersion.id)
  }

  const handleConfirmDelete = async () => {
    const deleted = await deleteVersion(version.id)

    if (!deleted) {
      return
    }

    setDeleteTargetId(null)
  }

  return (
    <>
      <motion.article
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: index * 0.04 }}
        className="relative"
      >
        <span
          className={cn(
            'absolute -left-[33px] top-6 flex size-4 items-center justify-center rounded-full border-2 bg-background',
            sourceMeta.nodeClassName,
          )}
        />

        <article
          className={cn(
            'relative overflow-hidden rounded-2xl border border-border/70 bg-background transition-colors',
            'hover:border-border/90 hover:shadow-xs',
            sourceMeta.surfaceClassName,
            showSelectedState && sourceMeta.selectedSurfaceClassName,
          )}
        >
          <div className="flex items-start gap-3 px-4 py-4">
            <button
              type="button"
              className="flex min-w-0 flex-1 flex-col gap-4 text-left"
              onClick={() => onSelectEntry(version.id)}
            >
              <div className="flex min-w-0 flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">
                    V
                    {version.version_no}
                  </Badge>
                  <Badge className={sourceMeta.badgeClassName}>
                    <SourceIcon data-icon="inline-start" />
                    {sourceMeta.label}
                  </Badge>
                  {version.milestone_name && (
                    <Badge variant="outline" className="border-primary/20 text-primary">
                      <Flag data-icon="inline-start" />
                      {version.milestone_name}
                    </Badge>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="truncate text-base font-semibold sm:text-lg">{getVersionTitle(version)}</div>
                  <div className="text-sm leading-6 text-muted-foreground">
                    {getVersionSubtitle(version)}
                    {' '}
                    ·
                    {' '}
                    {formatRelativeTime(version.created_at)}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{formatDateTime(version.created_at)}</Badge>
              </div>

              {(version.description || (version.tags?.length ?? 0) > 0) && (
                <div className="flex flex-col gap-3">
                  {version.description && (
                    <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
                      {version.description}
                    </p>
                  )}

                  {(version.tags?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {version.tags?.slice(0, 3).map(tag => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                      {(version.tags?.length ?? 0) > 3 && (
                        <Badge variant="outline">
                          +
                          {(version.tags?.length ?? 0) - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              )}
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="shrink-0">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
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
                  <DropdownMenuItem variant="destructive" onClick={() => setDeleteTargetId(version.id)}>
                    <Trash2 />
                    删除版本
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </article>
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
