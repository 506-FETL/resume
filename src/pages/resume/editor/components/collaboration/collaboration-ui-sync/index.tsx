import type { RefObject } from 'react'
import type { CollaborationIdentity, UIAction } from '@/lib/collaboration'
import type { ORDERType } from '@/lib/schema'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useConfigBroadcast } from '@/pages/resume/editor/hooks/use-config-broadcast'
import { useRealtimeCollaborationUI } from '@/pages/resume/editor/hooks/use-realtime-collaboration-ui'
import { useRemoteCollaborationAction } from '@/pages/resume/editor/hooks/use-remote-collaboration-action'
import { useScrollSync } from '@/pages/resume/editor/hooks/use-scroll-sync'
import { useSectionToggleBroadcast } from '@/pages/resume/editor/hooks/use-section-toggle-broadcast'
import { useTabDrawerBroadcast } from '@/pages/resume/editor/hooks/use-tab-drawer-broadcast'
import useResumeConfigStore from '@/store/resume/config'
import { FollowModeToggle } from './follow-mode-toggle'
import { OnlineCollaborators } from './online-collaborators'

interface CollaborationUISyncProps {
  roomName: string
  identity: CollaborationIdentity
  drawerOpen: boolean
  setDrawerOpen: (open: boolean) => void
  activeTabId: ORDERType
  updateActiveTabId: (id: ORDERType) => void
  scrollContainerRef: RefObject<HTMLDivElement | null>
}

export function CollaborationUISync({
  roomName,
  identity,
  drawerOpen,
  setDrawerOpen,
  activeTabId,
  updateActiveTabId,
  scrollContainerRef,
}: CollaborationUISyncProps) {
  const [followMode, setFollowMode] = useState(true)
  const spacing = useResumeConfigStore(state => state.spacing)
  const font = useResumeConfigStore(state => state.font)
  const theme = useResumeConfigStore(state => state.theme)
  const isApplyingRemote = useRef(false)
  const broadcastUIActionRef = useRef<(action: UIAction) => void>(() => {})

  const stableBroadcastUIAction = useCallback((action: UIAction) => {
    broadcastUIActionRef.current(action)
  }, [])

  const {
    suppressScrollSync,
    animateRemoteScrollTo,
  } = useScrollSync({
    scrollContainerRef,
    isApplyingRemote,
    followMode,
    broadcastUIAction: stableBroadcastUIAction,
  })

  const handleRemoteAction = useRemoteCollaborationAction({
    followMode,
    isApplyingRemote,
    setDrawerOpen,
    updateActiveTabId,
    suppressScrollSync,
    animateRemoteScrollTo,
  })

  const { broadcastUIAction, remoteUsers } = useRealtimeCollaborationUI({
    roomName,
    userName: identity.userName,
    color: identity.color,
    actionBroadcastEnabled: followMode,
    drawerOpen,
    activeTabId,
    onRemoteAction: handleRemoteAction,
  })

  useEffect(() => {
    broadcastUIActionRef.current = broadcastUIAction
  }, [broadcastUIAction])

  useTabDrawerBroadcast({
    drawerOpen,
    activeTabId,
    isApplyingRemote,
    broadcastUIAction,
  })

  useSectionToggleBroadcast({
    isApplyingRemote,
    broadcastUIAction,
  })

  useConfigBroadcast({
    spacing,
    font,
    theme,
    isApplyingRemote,
    broadcastUIAction,
  })

  const toggleFollowMode = useCallback(() => {
    setFollowMode(!followMode)
    toast.info(followMode ? '已关闭跟随模式' : '已开启跟随模式', {
      description: followMode
        ? '将不再跟随协作者，也不会同步你的 UI 操作'
        : '将自动跟随协作者的 UI 操作',
      duration: 2000,
    })
  }, [followMode])

  return (
    <div className="flex items-center gap-2">
      <FollowModeToggle enabled={followMode} onToggle={toggleFollowMode} />
      <OnlineCollaborators users={remoteUsers} />
    </div>
  )
}
