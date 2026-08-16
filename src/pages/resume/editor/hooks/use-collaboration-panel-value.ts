import type { CollaborationPanelContextValue } from './../types'
import { useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useIsMobile } from '@/hooks/use-mobile'
import useResumeStore from '@/store/resume/form'

/**
 * 编辑器顶部区域仍复用原“协作面板”容器承载手动保存和分享入口。
 * 跨账号实时协作已退役，因此所有会话相关字段固定为不可用状态。
 */
export function useCollaborationPanelValue(): CollaborationPanelContextValue {
  const isMobile = useIsMobile()
  const {
    manualSync,
    isSyncing,
    pendingChanges,
    lastSyncTime,
  } = useResumeStore(useShallow(state => ({
    manualSync: state.manualSync,
    isSyncing: state.isSyncing,
    pendingChanges: state.pendingChanges,
    lastSyncTime: state.lastSyncTime,
  })))

  const handleManualSync = useCallback(() => manualSync(), [manualSync])
  const noop = useCallback(() => {}, [])
  const noopAsync = useCallback(() => Promise.resolve(), [])

  return {
    isMobile,
    isSyncing,
    pendingChanges,
    lastSyncTime,
    isSharing: false,
    isCollabConnecting: false,
    collaborationConnectionPhase: null,
    collaborationConnectionLabel: null,
    collabDisabledReason: '跨账号实时协作已停用，请使用快照分享与评论',
    shareButtonTooltip: '跨账号实时协作已停用，请使用快照分享与评论',
    participantCount: 0,
    shareUrl: null,
    collaborationRole: null,
    collaborationError: null,
    canStartSharing: false,
    collabDialogOpen: false,
    onManualSync: handleManualSync,
    onCopyShareLink: noop,
    onStartSharing: noopAsync,
    onStopSharing: noop,
    openCollaborationDialog: noop,
    closeCollaborationDialog: noop,
    setCollaborationDialogOpen: noop,
  }
}
