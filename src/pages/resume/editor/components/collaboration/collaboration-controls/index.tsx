import { ArrowUpDown, Clock, Link2, Loader2, Radio, Save, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { isOfflineResumeId } from '@/lib/offline-resume-manager'
import { cn } from '@/lib/utils'
import useResumeListStore from '@/pages/resume/store'
import useShareStore from '@/pages/share/store'
import { useCurrentResumeStore } from '@/store/resume'
import { formatTime } from '@/utils/date'
import { useCollaborationPanel } from '../context'

interface CollaborationControlsProps {
  onOpenSortDialog?: () => void
  /** 侧栏形态：不使用 Drawer 原语，改用普通元素 */
  plain?: boolean
}

export function CollaborationControls({ onOpenSortDialog, plain = false }: CollaborationControlsProps = {}) {
  const {
    isMobile,
    isSyncing,
    pendingChanges,
    lastSyncTime,
    onManualSync,
    openCollaborationDialog,
    isSharing,
    isCollabConnecting,
    collabDisabledReason,
    shareButtonTooltip,
    participantCount,
  } = useCollaborationPanel()

  const resumeId = useCurrentResumeStore(state => state.resumeId)
  const resumes = useResumeListStore(state => state.resumes)
  const resumeName = resumeId ? (resumes.find(r => r.resume_id === resumeId)?.display_name ?? null) : null
  const { openDialog: openQuickDialog } = useShareStore()
  const isOffline = Boolean(resumeId) && isOfflineResumeId(resumeId!)
  const canShare = Boolean(resumeId) && !isOffline
  const shareDisabledReason = !resumeId
    ? '当前未选择简历'
    : isOffline
      ? '离线简历需先同步到云端才能分享'
      : undefined

  const HeaderTag = plain ? 'div' : DrawerHeader
  const TitleTag = plain ? 'div' : DrawerTitle

  const body = (
    <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-3">
      <span>实时同步到云端</span>
      <div className="flex items-center gap-2">
        <Button
          size={isMobile ? 'icon' : 'sm'}
          variant="outline"
          onClick={onManualSync}
          disabled={isSyncing || !pendingChanges}
        >
          <Save className="size-4" />
          {!isMobile && '手动保存'}
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                size={isMobile ? 'icon' : 'sm'}
                variant={isSharing ? 'default' : 'outline'}
                onClick={openCollaborationDialog}
                disabled={Boolean(collabDisabledReason) || isCollabConnecting}
                className={cn(
                  'transition-colors',
                  isSharing && !isCollabConnecting && 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm',
                )}
              >
                {isCollabConnecting
                  ? <Loader2 className="size-4 animate-spin" />
                  : isSharing
                    ? <Radio className="size-4" />
                    : <Share2 className="size-4" />}
                {!isMobile && (isSharing ? '协作中' : '开启协作')}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">{shareButtonTooltip}</TooltipContent>
        </Tooltip>
        <Button
          size={isMobile ? 'icon' : 'sm'}
          variant="outline"
          onClick={() => resumeId && openQuickDialog(resumeId, resumeName)}
          disabled={!canShare}
          title={shareDisabledReason}
        >
          <Link2 className="size-4" />
          {!isMobile && '分享'}
        </Button>
        {isSharing && (
          <span className="text-xs font-medium text-emerald-600">
            协作人数
            {participantCount}
          </span>
        )}
        {isMobile && onOpenSortDialog && (
          <Button
            size="icon"
            variant="outline"
            onClick={onOpenSortDialog}
            aria-label="调整模块顺序"
          >
            <ArrowUpDown className="size-4" />
          </Button>
        )}
      </div>
    </div>
  )

  return (
    <HeaderTag className={cn('relative', plain && 'flex flex-col gap-1.5 p-4')}>
      <TitleTag className="flex items-center gap-3 font-semibold">
        简历信息
        {renderSyncStatus({ isSyncing, pendingChanges, lastSyncTime })}
      </TitleTag>
      {plain ? body : <DrawerDescription asChild>{body}</DrawerDescription>}
    </HeaderTag>
  )
}

function renderSyncStatus({
  isSyncing,
  pendingChanges,
  lastSyncTime,
}: {
  isSyncing: boolean
  pendingChanges: boolean
  lastSyncTime: number | null
}) {
  if (isSyncing) {
    return (
      <span className="flex items-center gap-2 text-sm text-muted-foreground font-normal">
        <Clock className="size-4 animate-spin" />
        同步中...
      </span>
    )
  }

  if (pendingChanges) {
    return (
      <span className="flex items-center gap-2 text-sm text-amber-600 font-normal">
        <Clock className="size-4" />
        有未保存的更改
      </span>
    )
  }

  if (lastSyncTime) {
    return (
      <span className="text-sm text-green-600 font-normal">
        已同步
        {formatTime(lastSyncTime)}
      </span>
    )
  }

  return null
}
