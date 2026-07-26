import type { RefObject } from 'react'
import type { ORDERType } from '@/lib/schema'
import { useCollaborationStore } from '@/lib/collaboration'
import { CollaborationUISync } from '../collaboration-ui-sync'
import { RealtimeCursors } from '../realtime-cursors'

interface CollaborationRuntimeProps {
  drawerOpen: boolean
  setDrawerOpen: (open: boolean) => void
  activeTabId: ORDERType
  updateActiveTabId: (id: ORDERType) => void
  scrollContainerRef: RefObject<HTMLDivElement | null>
}

export function CollaborationRuntime({
  drawerOpen,
  setDrawerOpen,
  activeTabId,
  updateActiveTabId,
  scrollContainerRef,
}: CollaborationRuntimeProps) {
  const roomName = useCollaborationStore(state => state.roomName)
  const isSharing = useCollaborationStore(state => state.isSharing)
  const self = useCollaborationStore(state => state.self)

  if (!roomName || !isSharing || !self) {
    return null
  }

  return (
    <>
      <RealtimeCursors roomName={roomName} identity={self} />
      <CollaborationUISync
        roomName={roomName}
        identity={self}
        drawerOpen={drawerOpen}
        setDrawerOpen={setDrawerOpen}
        activeTabId={activeTabId}
        updateActiveTabId={updateActiveTabId}
        scrollContainerRef={scrollContainerRef}
      />
    </>
  )
}
