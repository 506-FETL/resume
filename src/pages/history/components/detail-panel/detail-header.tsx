import { historyComponent } from '../../utils/load-component'
import type { ReactNode } from 'react'
import type { RestoreStrategy } from '../../types'
import type { HistoryDetailPanelState } from './use-detail-panel-state'
import {
  Clock3,
  Edit3,
  GitCompare,
  MoreHorizontal,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatDateTime, formatRelativeTime } from '@/utils/date'
import { SOURCE_META } from '../../const'
import { useHistoryMotion } from '../../hooks/use-history-motion'
import useHistoryStore from '../../store'
import {
  getCurrentSyncState,
  getResumeTypeLabel,
  getVersionTitle,
} from '../../utils'
import HistoryDialogs from '../dialogs'
import { deferDialog } from '@/components/deferred-dialog'
import HistoryActionButton from '../shared/history-action-button'

const DeferredCompare = deferDialog(
  historyComponent(() => import('../compare-dialog'), 'CompareDialog'),
  '版本对比',
)

interface DetailHeaderProps {
  state: HistoryDetailPanelState
  exportButton: ReactNode
}

export default function DetailHeader({
  state,
  exportButton,
}: DetailHeaderProps) {
  const { surfaceProps } = useHistoryMotion()

  const currentResume = useHistoryStore((s) => s.currentResume)
  const latestVersion = useHistoryStore((s) => s.latestVersion)
  const versionTotal = useHistoryStore((s) => s.versionTotal)
  const versionSummaryReady = useHistoryStore((s) => s.versionSummaryReady)
  const versionsError = useHistoryStore((s) => s.versionsError)
  const currentResumeLoading = useHistoryStore((s) => s.currentResumeLoading)
  const currentResumeError = useHistoryStore((s) => s.currentResumeError)
  const savingMetadata = useHistoryStore((s) => s.savingMetadata)
  const { restoreVersion, deleteVersion } = useHistoryStore.getState()

  const [restoreTargetId, setRestoreTargetId] = useState<number | null>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)
  const [compareOpen, setCompareOpen] = useState(false)
  const { selectedEntry, selectedVersion, editing } = state
  const restoreRef = useRef<HTMLButtonElement>(null)
  const moreRef = useRef<HTMLButtonElement>(null)
  const editButtonRef = useRef<HTMLButtonElement>(null)
  const saveButtonRef = useRef<HTMLButtonElement>(null)
  const previousStateRef = useRef({ selectedEntry, editing })

  useLayoutEffect(() => {
    const previous = previousStateRef.current

    if (
      previous.selectedEntry === selectedEntry &&
      previous.editing !== editing
    ) {
      const button = editing ? saveButtonRef.current : editButtonRef.current

      button?.focus({ preventScroll: true })
    }

    previousStateRef.current = { selectedEntry, editing }
  }, [editing, selectedEntry])

  useEffect(() => {
    setRestoreTargetId(null)
    setDeleteTargetId(null)
    setCompareOpen(false)
  }, [selectedEntry])

  const handleConfirmRestore = async (strategy: RestoreStrategy) => {
    if (!restoreTargetId) return

    const restoredVersion = await restoreVersion(restoreTargetId, strategy)

    if (!restoredVersion) return

    setRestoreTargetId(null)
    state.selectEntry(restoredVersion.id)
  }

  const handleConfirmDelete = async () => {
    if (deleteTargetId && (await deleteVersion(deleteTargetId)))
      setDeleteTargetId(null)
  }

  if (selectedEntry === 'current' && currentResume) {
    const syncState = getCurrentSyncState(currentResume, latestVersion)

    return (
      <div className='flex min-w-0 flex-col gap-2 [@media(max-height:500px)]:gap-1'>
        <h2 className='line-clamp-2 min-w-0 break-words text-xl leading-snug font-semibold tracking-tight sm:text-2xl [@media(max-height:500px)]:line-clamp-1'>
          {currentResume.displayName}
        </h2>
        <div className='flex flex-wrap items-center gap-x-3 gap-y-1.5'>
          <Badge variant='secondary' className='font-normal'>
            当前内容
          </Badge>
          <span className='text-xs text-muted-foreground'>
            {!versionSummaryReady ? (
              versionsError ? (
                '版本状态暂不可用'
              ) : (
                <Skeleton className='h-3 w-24' />
              )
            ) : versionTotal === 0 ? (
              '尚未保存版本'
            ) : syncState.synced ? (
              `已与 V${syncState.latestVersionNo} 同步`
            ) : (
              '有未保存的修改'
            )}
          </span>
        </div>
        <div className='flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground'>
          <span className='flex items-center gap-1.5'>
            <Clock3 className='size-3.5' />
            {currentResume.updatedAt
              ? `${formatRelativeTime(currentResume.updatedAt)}更新`
              : '暂无更新时间'}
          </span>
          <span>{getResumeTypeLabel(currentResume.type)}</span>
        </div>
      </div>
    )
  }

  if (!selectedVersion) return null

  const sourceMeta = SOURCE_META[selectedVersion.source_type]

  const canCompare = (versionTotal ?? 0) >= 2 || Boolean(currentResume)

  return (
    <div className='flex min-w-0 flex-col gap-3 [@media(max-height:500px)]:gap-1'>
      <h2 className='line-clamp-2 min-w-0 break-words text-xl leading-snug font-semibold tracking-tight sm:text-2xl [@media(max-height:500px)]:line-clamp-1'>
        {getVersionTitle(selectedVersion)}
      </h2>
      <div className='scrollbar-thin-subtle flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground [@media(max-height:500px)]:flex-nowrap [@media(max-height:500px)]:overflow-x-auto [@media(max-height:500px)]:whitespace-nowrap'>
        <Badge variant='secondary' className='font-normal'>
          V{selectedVersion.version_no}
        </Badge>
        <span>{sourceMeta.label}</span>
        <time dateTime={selectedVersion.created_at}>
          {formatDateTime(selectedVersion.created_at)}
        </time>
        {selectedVersion.milestone_name && (
          <Badge
            variant='outline'
            className='max-w-full truncate border-primary/20 text-primary'
          >
            {selectedVersion.milestone_name}
          </Badge>
        )}
      </div>
      <div className='flex min-h-8 flex-wrap items-center gap-2'>
        {editing ? (
          <>
            <Button
              ref={saveButtonRef}
              size='sm'
              onClick={state.submitEditDraft}
              disabled={savingMetadata}
            >
              <Save data-icon='inline-start' />
              {savingMetadata ? '保存中…' : '保存修改'}
            </Button>
            <Button
              variant='outline'
              size='sm'
              onClick={state.cancelEditing}
              disabled={savingMetadata}
            >
              取消
            </Button>
          </>
        ) : (
          <>
            <HistoryActionButton
              label='对比'
              disabled={!canCompare}
              onClick={() => {
                const prior = useHistoryStore
                  .getState()
                  .versions.find(
                    (row) => row.version_no === selectedVersion.version_no - 1,
                  )

                if (prior)
                  useHistoryStore.getState().loadVersionSnapshot(prior.id)

                setCompareOpen(true)
              }}
            >
              <GitCompare />
            </HistoryActionButton>
            <HistoryActionButton
              ref={restoreRef}
              label='恢复此版本'
              variant='outline'
              disabled={
                !currentResume ||
                currentResumeLoading ||
                Boolean(currentResumeError)
              }
              onClick={() => setRestoreTargetId(selectedVersion.id)}
            >
              <RotateCcw />
            </HistoryActionButton>
            {exportButton}
            <HistoryActionButton
              ref={editButtonRef}
              label='编辑信息'
              variant='outline'
              compact
              onClick={state.startEditing}
            >
              <Edit3 />
            </HistoryActionButton>
            <DropdownMenu key={`menu-${selectedVersion.id}`}>
              <DropdownMenuTrigger asChild>
                <Button
                  ref={moreRef}
                  variant='ghost'
                  size='icon-sm'
                  className='max-md:size-9'
                  aria-label='更多版本操作'
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                {...surfaceProps}
                className={`${surfaceProps.className} history-popup-motion`}
                align='end'
              >
                <DropdownMenuItem
                  variant='destructive'
                  onClick={() => setDeleteTargetId(selectedVersion.id)}
                >
                  <Trash2 />
                  删除版本
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
      <DeferredCompare open={compareOpen} onClose={() => setCompareOpen(false)}>
        {(Dialog, opener) => (
          <Dialog
            open={compareOpen}
            onOpenChange={setCompareOpen}
            selectedVersion={selectedVersion}
            returnFocusTo={opener}
          />
        )}
      </DeferredCompare>
      <HistoryDialogs
        returnFocusTo={deleteTargetId ? moreRef.current : restoreRef.current}
        restoreTargetId={restoreTargetId}
        deleteTargetId={deleteTargetId}
        onCloseRestore={() => setRestoreTargetId(null)}
        onConfirmRestore={handleConfirmRestore}
        onCloseDelete={() => setDeleteTargetId(null)}
        onConfirmDelete={handleConfirmDelete}
      />
    </div>
  )
}
