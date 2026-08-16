import type { RestoreStrategy } from '../../types'
import type { HistoryDetailPanelState } from './use-detail-panel-state'
import { Clock3, Edit3, GitCompare, RotateCcw, Save, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { formatDateTime, formatRelativeTime } from '@/utils/date'
import { SOURCE_META } from '../../const'
import useHistoryStore from '../../store'
import { getCurrentSyncState, getResumeTypeLabel, getVersionTitle } from '../../utils'
import CompareDialog from '../compare-dialog'
import HistoryDialogs from '../dialogs'
import SaveVersionDialog from '../save-version-dialog'
import VersionPdfExportButton from '../version-pdf-export'

interface DetailHeaderProps {
  state: HistoryDetailPanelState
}

export default function DetailHeader({ state }: DetailHeaderProps) {
  const isMobile = useIsMobile()
  const { currentResume, versions, savingMetadata, restoreVersion, deleteVersion } = useHistoryStore()
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [restoreTargetId, setRestoreTargetId] = useState<number | null>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)
  const [compareOpen, setCompareOpen] = useState(false)
  const { selectedEntry, selectedVersion, editing } = state
  const isCurrent = selectedEntry === 'current'

  useEffect(() => {
    setSaveDialogOpen(false)
    setRestoreTargetId(null)
    setDeleteTargetId(null)
    setCompareOpen(false)
  }, [selectedEntry])

  const handleConfirmRestore = async (strategy: RestoreStrategy) => {
    if (!restoreTargetId) {
      return
    }

    const restoredVersion = await restoreVersion(restoreTargetId, strategy)

    if (!restoredVersion) {
      return
    }

    setRestoreTargetId(null)
    state.selectEntry(restoredVersion.id)
  }

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) {
      return
    }

    const deleted = await deleteVersion(deleteTargetId)

    if (!deleted) {
      return
    }

    setDeleteTargetId(null)
  }

  if (isCurrent && currentResume) {
    const syncState = getCurrentSyncState(currentResume, versions)

    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">当前版本</Badge>
              {versions.length === 0
                ? (
                    <Badge variant="outline">暂无版本记录</Badge>
                  )
                : syncState.synced
                  ? (
                      <Badge variant="outline">
                        已与 V
                        {syncState.latestVersionNo}
                        同步
                      </Badge>
                    )
                  : (
                      <Badge variant="outline" className="border-primary/20 text-primary">存在未保存更新</Badge>
                    )}
            </div>

            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-semibold tracking-tight">{currentResume.displayName}</h2>
              <p className="text-sm text-muted-foreground">
                {currentResume.description || '当前正在编辑的内容。'}
              </p>
            </div>
          </div>

          <div
            className={cn(
              'grid w-full gap-2 sm:w-auto',
              isMobile ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2',
            )}
          >
            <Button onClick={() => setSaveDialogOpen(true)}>
              <Save data-icon="inline-start" />
              保存当前版本
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">
            <Clock3 />
            {currentResume.updatedAt ? formatRelativeTime(currentResume.updatedAt) : '暂无更新时间'}
          </Badge>
          {currentResume.updatedAt && (
            <Badge variant="outline">{formatDateTime(currentResume.updatedAt)}</Badge>
          )}
          <Badge variant="outline">
            模板：
            {getResumeTypeLabel(currentResume.type)}
          </Badge>
        </div>
        <SaveVersionDialog
          open={saveDialogOpen}
          onOpenChange={setSaveDialogOpen}
          onSaved={versionId => state.selectEntry(versionId)}
        />
      </div>
    )
  }

  if (!selectedVersion) {
    return null
  }

  const sourceMeta = SOURCE_META[selectedVersion.source_type]
  const SourceIcon = sourceMeta.icon

  // 默认基准＝比当前选中版更早的最近一版；没有更早版本则回退到「当前内容」
  const olderVersion = versions.find(version => version.version_no < selectedVersion.version_no)
  const compareBaseId = olderVersion ? String(olderVersion.id) : 'current'
  const canCompare = versions.length >= 2 || Boolean(currentResume)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              V
              {selectedVersion.version_no}
            </Badge>
            <Badge className={sourceMeta.badgeClassName}>
              <SourceIcon data-icon="inline-start" />
              {sourceMeta.label}
            </Badge>
            {selectedVersion.milestone_name && (
              <Badge variant="outline" className="border-primary/20 text-primary">
                <Sparkles data-icon="inline-start" />
                {selectedVersion.milestone_name}
              </Badge>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-semibold tracking-tight">{getVersionTitle(selectedVersion)}</h2>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto">
          {!editing
            ? (
                <>
                  <div
                    className={cn(
                      'grid gap-2 justify-center',
                      isMobile ? 'grid-cols-5' : 'grid-cols-2',
                    )}
                  >
                    <Button
                      className="w-full"
                      variant="outline"
                      size={isMobile ? 'icon' : 'default'}
                      disabled={!canCompare}
                      title={canCompare ? undefined : '还没有可对比的版本'}
                      onClick={() => setCompareOpen(true)}
                    >
                      <GitCompare data-icon="inline-start" />
                      {!isMobile && '对比'}
                    </Button>

                    <VersionPdfExportButton
                      className="w-full"
                      versionId={selectedVersion.id}
                      documentTitle={getVersionTitle(selectedVersion)}
                    />

                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => setRestoreTargetId(selectedVersion.id)}
                      size={isMobile ? 'icon' : 'default'}
                    >
                      <RotateCcw data-icon="inline-start" />
                      {!isMobile && '恢复此版本'}
                    </Button>

                    <Button
                      className="w-full"
                      size={isMobile ? 'icon' : 'default'}
                      onClick={state.startEditing}
                    >
                      <Edit3 data-icon="inline-start" />
                      {!isMobile && '编辑信息'}
                    </Button>

                    <Button
                      className="w-full"
                      variant="destructive"
                      onClick={() => setDeleteTargetId(selectedVersion.id)}
                      size={isMobile ? 'icon' : 'default'}
                    >
                      <Trash2 data-icon="inline-start" />
                      {!isMobile && '删除版本'}
                    </Button>
                  </div>
                </>
              )
            : (
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" className="w-full justify-center" onClick={state.cancelEditing} disabled={savingMetadata}>
                    取消
                  </Button>
                  <Button className="w-full justify-center" onClick={state.submitEditDraft} disabled={savingMetadata}>
                    <Save data-icon="inline-start" />
                    {savingMetadata ? '保存中...' : '保存修改'}
                  </Button>
                </div>
              )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">{formatRelativeTime(selectedVersion.created_at)}</Badge>
        <Badge variant="outline">{formatDateTime(selectedVersion.created_at)}</Badge>
        <Badge variant="outline">{sourceMeta.label}</Badge>
      </div>
      <CompareDialog
        open={compareOpen}
        onOpenChange={setCompareOpen}
        baseId={compareBaseId}
        targetId={String(selectedVersion.id)}
      />
      <SaveVersionDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        onSaved={versionId => state.selectEntry(versionId)}
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
