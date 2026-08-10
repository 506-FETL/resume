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
          'relative overflow-hidden rounded-2xl border border-primary/10 bg-linear-to-br from-primary/[0.05] via-background to-background transition-colors',
          'hover:border-primary/20 hover:bg-primary/[0.04]',
          selected && 'border-primary/25 bg-linear-to-br from-primary/[0.14] via-primary/[0.05] to-background ring-1 ring-primary/12',
        )}
      >
        <div className="flex items-start gap-3 px-4 py-4">
          <button
            type="button"
            className="flex min-w-0 flex-1 flex-col gap-4 text-left"
            onClick={() => onSelectEntry('current')}
          >
            <div className="flex min-w-0 flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">
                  <ShieldCheck data-icon="inline-start" />
                  当前版本
                </Badge>
                <Badge variant="outline" className={cn(!synced && versions.length > 0 && 'border-primary/20 text-primary')}>
                  {versions.length > 0 && synced && <Sparkles data-icon="inline-start" />}
                  {syncLabel}
                </Badge>
              </div>

              <div className="flex min-w-0 flex-col gap-1.5">
                <div className="truncate text-base font-semibold sm:text-lg">{currentResume.displayName}</div>
                <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
                  {currentResume.description || '当前正在编辑的内容。'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">
                上次改动
                {' '}
                {currentResume.updatedAt ? formatRelativeTime(currentResume.updatedAt) : '未知'}
              </Badge>
              {currentResume.updatedAt && (
                <Badge variant="outline">{formatDateTime(currentResume.updatedAt)}</Badge>
              )}
              <Badge variant="outline">
                模板
                {' '}
                {getResumeTypeLabel(currentResume.type)}
              </Badge>
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
