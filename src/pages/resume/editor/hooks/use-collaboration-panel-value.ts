import type { CollaborationPanelContextValue, SupabaseUser } from './../types'
import type { CollaborationPhase } from '@/lib/collaboration'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useShallow } from 'zustand/react/shallow'
import { useIsMobile } from '@/hooks/use-mobile'
import { useCollaborationStore } from '@/lib/collaboration'
import useResumeStore from '@/store/resume/form'
import { getErrorMessage } from '@/utils'

interface UseCollaborationPanelValueParams {
  currentUser: SupabaseUser
  activeResumeId?: string
  userDisplayName: string
}

function getConnectionPhaseLabel(phase: CollaborationPhase): string | null {
  switch (phase) {
    case 'authenticating':
      return '正在确认登录状态'
    case 'authorizing':
      return '正在验证协作权限'
    case 'hydrating':
      return '正在加载共享简历'
    case 'connecting':
      return '正在连接协作服务'
    case 'syncing':
      return '正在同步当前简历'
    case 'stopping':
      return '正在停止共享'
    case 'idle':
    case 'connected':
    case 'ended':
    case 'error':
      return null
    default: {
      const exhaustivePhase: never = phase
      return exhaustivePhase
    }
  }
}

export function useCollaborationPanelValue({
  currentUser,
  activeResumeId,
  userDisplayName,
}: UseCollaborationPanelValueParams): CollaborationPanelContextValue {
  const isMobile = useIsMobile()
  const [collabDialogOpen, setCollabDialogOpen] = useState(false)
  const [, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const {
    manualSync,
    isSyncing,
    pendingChanges,
    lastSyncTime,
    mode,
    isDocumentInitialized,
  } = useResumeStore(useShallow(state => ({
    manualSync: state.manualSync,
    isSyncing: state.isSyncing,
    pendingChanges: state.pendingChanges,
    lastSyncTime: state.lastSyncTime,
    mode: state.mode,
    isDocumentInitialized: state.isInitialized,
  })))

  const {
    participants,
    isSharing,
    isCollabConnecting,
    collaborationConnectionPhase,
    shareUrl,
    collaborationRole,
    startSharing,
    stopSharing,
    collaborationError,
    shareEndedByRemote,
    acknowledgeRemoteShareEnd,
  } = useCollaborationStore(useShallow(state => ({
    participants: state.participants,
    isSharing: state.isSharing,
    isCollabConnecting: state.isConnecting,
    collaborationConnectionPhase: state.phase,
    shareUrl: state.shareUrl,
    collaborationRole: state.role,
    startSharing: state.startSharing,
    stopSharing: state.stopSharing,
    collaborationError: state.error,
    shareEndedByRemote: state.shareEndedByRemote,
    acknowledgeRemoteShareEnd: state.acknowledgeRemoteShareEnd,
  })))

  const participantCount = Object.keys(participants).length

  const collabDisabledReason = useMemo(() => {
    if (mode !== 'online')
      return '离线简历暂不支持实时协作'
    if (!currentUser)
      return '请先登录以启用实时协作'
    if (!isDocumentInitialized)
      return '数据加载中，请稍候'
    return null
  }, [mode, currentUser, isDocumentInitialized])

  const collaborationConnectionLabel = getConnectionPhaseLabel(collaborationConnectionPhase)
  const shareButtonTooltip = collabDisabledReason
    ?? collaborationConnectionLabel
    ?? (isSharing ? '查看协作信息' : '开启实时协作')
  const canCopyLink = typeof navigator !== 'undefined' && !!navigator.clipboard

  const handleManualSync = useCallback(() => manualSync(), [manualSync])

  const handleStartSharing = useCallback(async () => {
    if (!activeResumeId || !currentUser)
      return
    try {
      await startSharing({
        resumeId: activeResumeId,
        userId: currentUser.id,
        userName: userDisplayName || `用户-${currentUser.id.slice(0, 6)}`,
      })
      const newSessionId = useCollaborationStore.getState().sessionId
      if (newSessionId) {
        const params = new URLSearchParams(window.location.search)
        params.set('resumeId', activeResumeId)
        params.set('collabSession', newSessionId)
        params.delete('docUrl')
        setSearchParams(params, { replace: true })
      }
    }
    catch (error: unknown) {
      const msg = getErrorMessage(error, '')
      toast.error(`开启实时协作失败，请稍后重试${msg ? `: ${msg}` : ''}`)
    }
  }, [activeResumeId, currentUser, setSearchParams, startSharing, userDisplayName])

  const handleStopSharing = useCallback(async () => {
    try {
      await stopSharing()

      if (collaborationRole === 'guest') {
        setCollabDialogOpen(false)
        navigate('/resume', { replace: true })
        return
      }

      const params = new URLSearchParams(window.location.search)
      params.delete('collabSession')
      params.delete('docUrl')
      if (activeResumeId)
        params.set('resumeId', activeResumeId)
      setSearchParams(params, { replace: true })
      setCollabDialogOpen(false)
    }
    catch (error: unknown) {
      toast.error(`停止实时协作失败，请重试: ${getErrorMessage(error, '未知错误')}`)
    }
  }, [activeResumeId, collaborationRole, navigate, setSearchParams, stopSharing])

  const handleCopyShareLink = useCallback(() => {
    if (!shareUrl)
      return
    if (!canCopyLink) {
      toast.info('请手动复制链接')
      return
    }
    navigator.clipboard
      .writeText(shareUrl)
      .then(() => toast.success('已复制分享链接'))
      .catch(() => toast.error('复制失败，请手动复制'))
  }, [canCopyLink, shareUrl])

  const canStartSharing = Boolean(activeResumeId && currentUser && !collabDisabledReason && !isCollabConnecting)

  useEffect(() => {
    if (!shareEndedByRemote)
      return
    acknowledgeRemoteShareEnd()
    navigate('/resume', { replace: true })
  }, [acknowledgeRemoteShareEnd, navigate, shareEndedByRemote])

  const openCollaborationDialog = useCallback(() => setCollabDialogOpen(true), [])
  const closeCollaborationDialog = useCallback(() => {
    if (!useCollaborationStore.getState().isConnecting)
      setCollabDialogOpen(false)
  }, [])
  const setCollaborationDialogOpen = useCallback((open: boolean) => {
    if (!open && useCollaborationStore.getState().isConnecting)
      return
    setCollabDialogOpen(open)
  }, [])

  return {
    isMobile,
    isSyncing,
    pendingChanges,
    lastSyncTime,
    isSharing,
    isCollabConnecting,
    collaborationConnectionPhase,
    collaborationConnectionLabel,
    collabDisabledReason,
    shareButtonTooltip,
    participantCount,
    shareUrl,
    collaborationRole,
    collaborationError,
    canStartSharing,
    collabDialogOpen,
    onManualSync: handleManualSync,
    onCopyShareLink: handleCopyShareLink,
    onStartSharing: handleStartSharing,
    onStopSharing: handleStopSharing,
    openCollaborationDialog,
    closeCollaborationDialog,
    setCollaborationDialogOpen,
  }
}
