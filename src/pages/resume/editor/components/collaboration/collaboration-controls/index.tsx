import { ArrowUpDown, Clock, Cloud, HardDrive, Link2, Loader2, Radio, Save, Share2 } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { AnimatedContent } from '@/components/motion/animated-content'
import { Button } from '@/components/ui/button'
import { DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { isOfflineResumeId } from '@/lib/offline-resume-manager'
import { cn } from '@/lib/utils'
import useShareStore from '@/pages/share/store'
import { useCurrentResumeStore } from '@/store/resume'
import useResumeStore from '@/store/resume/form'
import { formatTime } from '@/utils/date'
import { useResumeDisplayName } from '../../../hooks/use-resume-display-name'
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
    collaborationConnectionLabel,
    collabDisabledReason,
    shareButtonTooltip,
    participantCount,
  } = useCollaborationPanel()

  const resumeId = useCurrentResumeStore(state => state.resumeId)
  const resumeName = useResumeDisplayName()
  const syncError = useResumeStore(state => state.syncError)
  const reduceMotion = useReducedMotion()
  const { openDialog: openQuickDialog } = useShareStore()
  const isOffline = Boolean(resumeId) && isOfflineResumeId(resumeId!)
  const canShare = Boolean(resumeId) && !isOffline
  const shareDisabledReason = !resumeId
    ? '当前未选择简历'
    : isOffline
      ? '离线简历需先同步到云端才能分享'
      : undefined

  const HeaderTag = plain ? 'div' : DrawerHeader
  const TitleTag = plain ? 'h2' : DrawerTitle
  const syncStatusKey = isSyncing ? 'syncing' : syncError ? 'error' : pendingChanges ? 'pending' : lastSyncTime ? 'saved' : 'idle'

  const body = (
    <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 mt-4">
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
                  ? <Loader2 className={cn('size-4', !reduceMotion && 'animate-spin')} />
                  : isSharing
                    ? <Radio className="size-4" />
                    : <Share2 className="size-4" />}
                {!isMobile && (collaborationConnectionLabel ?? (isSharing ? '协作中' : '开启协作'))}
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
      <div className="flex min-w-0 items-center gap-3">
        <TitleTag className="flex min-w-0 items-center gap-2 font-semibold">
          {isOffline
            ? <HardDrive aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            : <Cloud aria-hidden className="size-4 shrink-0 text-muted-foreground" />}
          <span className="truncate" title={resumeName}>{resumeName}</span>
        </TitleTag>
        <span role="status" aria-live="polite" className="shrink-0">
          <AnimatedContent as="span" animationKey={syncStatusKey} className="block">
            {renderSyncStatus({ isSyncing, syncError, pendingChanges, lastSyncTime, reduceMotion: !!reduceMotion })}
          </AnimatedContent>
        </span>
      </div>
      {plain ? body : <DrawerDescription render={body} />}
    </HeaderTag>
  )
}

function renderSyncStatus({
  isSyncing,
  syncError,
  pendingChanges,
  lastSyncTime,
  reduceMotion,
}: {
  isSyncing: boolean
  syncError: string | null
  pendingChanges: boolean
  lastSyncTime: number | null
  reduceMotion: boolean
}) {
  if (isSyncing) {
    return (
      <span className="flex items-center gap-2 text-sm text-muted-foreground font-normal">
        <Clock className={cn('size-4', !reduceMotion && 'animate-spin')} />
        同步中...
      </span>
    )
  }

  if (syncError) {
    return <span className="text-sm text-destructive font-normal">保存失败，请重试</span>
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
