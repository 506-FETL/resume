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
import CompareDialog from '../compare-dialog'
import HistoryDialogs from '../dialogs'
import VersionPdfExportButton from '../version-pdf-export'
import HistoryActionButton from '../shared/history-action-button'

interface DetailHeaderProps {
  state: HistoryDetailPanelState
}

export default function DetailHeader({ state }: DetailHeaderProps) {
  const { surfaceProps } = useHistoryMotion()

  const {
    currentResume,
    versions,
    savingMetadata,
    restoreVersion,
    deleteVersion,
  } = useHistoryStore()

  const [restoreTargetId, setRestoreTargetId] = useState<number | null>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)
  const [compareOpen, setCompareOpen] = useState(false)
  const { selectedEntry, selectedVersion, editing } = state
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
    const syncState = getCurrentSyncState(currentResume, versions)

    return (
      <div className='flex min-w-0 flex-col gap-2'>
        <h2
          className='line-clamp-2 min-w-0 break-words text-xl leading-snug font-semibold tracking-tight sm:text-2xl'
          title={currentResume.displayName}
        >
          {currentResume.displayName}
        </h2>
        <div className='flex flex-wrap items-center gap-x-3 gap-y-1.5'>
          <Badge variant='secondary' className='font-normal'>
            当前内容
          </Badge>
          <span className='text-xs text-muted-foreground'>
            {versions.length === 0
              ? '尚未保存版本'
              : syncState.synced
                ? `已与 V${syncState.latestVersionNo} 同步`
                : '有未保存的修改'}
          </span>
        </div>
        <div className='flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground'>
          <span
            className='flex items-center gap-1.5'
            title={
              currentResume.updatedAt
                ? formatDateTime(currentResume.updatedAt)
                : undefined
            }
          >
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

  const olderVersion = versions.find(
    (version) => version.version_no < selectedVersion.version_no,
  )

  const compareBaseId = olderVersion ? String(olderVersion.id) : 'current'
  const canCompare = versions.length >= 2 || Boolean(currentResume)

  return (
    <div className='flex min-w-0 flex-col gap-3'>
      <h2
        className='line-clamp-2 min-w-0 break-words text-xl leading-snug font-semibold tracking-tight sm:text-2xl'
        title={getVersionTitle(selectedVersion)}
      >
        {getVersionTitle(selectedVersion)}
      </h2>
      <div className='flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground'>
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
              title={canCompare ? undefined : '还没有可对比的版本'}
              onClick={() => setCompareOpen(true)}
            >
              <GitCompare />
            </HistoryActionButton>
            <HistoryActionButton
              label='恢复此版本'
              variant='outline'
              onClick={() => setRestoreTargetId(selectedVersion.id)}
            >
              <RotateCcw />
            </HistoryActionButton>
            <VersionPdfExportButton
              key={`pdf-${selectedVersion.id}`}
              versionId={selectedVersion.id}
              documentTitle={getVersionTitle(selectedVersion)}
              compact
            />
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
      <CompareDialog
        open={compareOpen}
        onOpenChange={setCompareOpen}
        baseId={compareBaseId}
        targetId={String(selectedVersion.id)}
      />
      <HistoryDialogs
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
