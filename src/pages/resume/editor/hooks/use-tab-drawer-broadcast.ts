import type { RefObject } from 'react'
import type { UIAction } from '@/lib/collaboration'
import type { ORDERType } from '@/lib/schema'
import { useEffect, useRef } from 'react'

interface UseTabDrawerBroadcastOptions {
  drawerOpen: boolean
  activeTabId: ORDERType
  isApplyingRemote: RefObject<boolean>
  broadcastUIAction: (action: UIAction) => void
}

export function useTabDrawerBroadcast({
  drawerOpen,
  activeTabId,
  isApplyingRemote,
  broadcastUIAction,
}: UseTabDrawerBroadcastOptions) {
  const previousDrawerOpen = useRef(drawerOpen)
  useEffect(() => {
    if (previousDrawerOpen.current !== drawerOpen) {
      previousDrawerOpen.current = drawerOpen
      if (!isApplyingRemote.current)
        broadcastUIAction({ kind: 'drawer-toggle', open: drawerOpen })
    }
  }, [drawerOpen, broadcastUIAction, isApplyingRemote])

  const previousActiveTab = useRef(activeTabId)
  useEffect(() => {
    if (previousActiveTab.current !== activeTabId) {
      previousActiveTab.current = activeTabId
      if (!isApplyingRemote.current)
        broadcastUIAction({ kind: 'tab-switch', tabId: activeTabId })
    }
  }, [activeTabId, broadcastUIAction, isApplyingRemote])
}
