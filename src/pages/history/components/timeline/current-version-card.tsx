import type { HistorySelection } from '../../types'
import { Eye, MoreHorizontal, Save, ShieldCheck, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { formatDateTime, formatRelativeTime } from '@/utils/date'
import useHistoryStore from '../../store'
import { getCurrentSyncState, getResumeTypeLabel } from '../../utils'
import SaveVersionDialog from '../save-version-dialog'

interface CurrentVersionCardProps {
  selected: boolean
  onSelectEntry: (target: HistorySelection) => void
}

export default function CurrentVersionCard({
  selected,
  onSelectEntry,
}: CurrentVersionCardProps) {
  const isMobile = useIsMobile()
  const { currentResume, versions } = useHistoryStore()
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)

  const { latestVersionNo, synced } = getCurrentSyncState(currentResume, versions)
  const syncLabel = versions.length === 0
    ? '暂无版本记录'
    : synced
      ? `已同步至 V${latestVersionNo}`
      : '有未保存的更新'

  useEffect(() => {
    setSaveDialogOpen(false)
  }, [currentResume?.resumeId])

  if (!currentResume) {
    return null
  }

  return (
    <>
      <article
        className={cn(
          'relative overflow-hidden rounded-xl border border-primary/12 bg-linear-to-br from-primary/[0.055] via-background to-background transition-[color,background-color,border-color,box-shadow]',
          'hover:border-primary/20 hover:shadow-xs',
          selected && 'border-primary/25 bg-linear-to-br from-primary/[0.1] via-primary/[0.035] to-background ring-1 ring-primary/10',
        )}
      >
        <div className="flex items-start gap-2.5 p-3">
          <button
            type="button"
            className="flex min-w-0 flex-1 flex-col gap-3 text-left"
            onClick={() => onSelectEntry('current')}
          >
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary" className="rounded-full border border-primary/10 bg-primary/[0.07] px-2 text-[11px] text-primary dark:text-chart-1">
                  <ShieldCheck data-icon="inline-start" />
                  当前版本
                </Badge>
                <Badge variant="outline" className={cn('rounded-full px-2 text-[11px] text-muted-foreground', !synced && versions.length > 0 && 'border-primary/20 bg-primary/[0.035] text-primary dark:text-chart-1')}>
                  {versions.length > 0 && synced && <Sparkles data-icon="inline-start" />}
                  {syncLabel}
                </Badge>
              </div>

              <div className="flex min-w-0 flex-col gap-1">
                <div className="truncate text-sm font-semibold">{currentResume.displayName}</div>
                <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                  {currentResume.description || '当前正在编辑的内容。'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] leading-4 text-muted-foreground">
              <span>
                上次改动
                {' '}
                {currentResume.updatedAt ? formatRelativeTime(currentResume.updatedAt) : '未知'}
              </span>
              {currentResume.updatedAt && (
                <span>{formatDateTime(currentResume.updatedAt)}</span>
              )}
              <span>
                模板
                {' '}
                {getResumeTypeLabel(currentResume.type)}
              </span>
            </div>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="shrink-0">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                {!isMobile && (
                  <DropdownMenuItem onClick={() => onSelectEntry('current')}>
                    <Eye />
                    查看简历
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => setSaveDialogOpen(true)}>
                  <Save />
                  保存当前版本
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </article>

      <SaveVersionDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        onSaved={versionId => onSelectEntry(versionId)}
      />
    </>
  )
}
