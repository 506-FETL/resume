import type { ReactNode } from 'react'
import type { CollaborationPhase } from '@/lib/collaboration/session/types'
import type { getCurrentUser } from '@/lib/supabase/user'

export type SupabaseUser = Awaited<ReturnType<typeof getCurrentUser>> | null

export interface CollaborationPanelContextValue {
  isMobile: boolean
  isSyncing: boolean
  pendingChanges: boolean
  lastSyncTime: number | null
  isSharing: boolean
  isCollabConnecting: boolean
  collaborationConnectionPhase: CollaborationPhase
  collaborationConnectionLabel: string | null
  collabDisabledReason: string | null
  shareButtonTooltip: string
  participantCount: number
  shareUrl: string | null
  collaborationRole: 'host' | 'guest' | null
  collaborationError: string | null
  canStartSharing: boolean
  collabDialogOpen: boolean
  onManualSync: () => void
  onCopyShareLink: () => void
  onStartSharing: () => Promise<void>
  onStopSharing: () => Promise<void>
  openCollaborationDialog: () => void
  closeCollaborationDialog: () => void
  setCollaborationDialogOpen: (open: boolean) => void
}

export interface Item<T> {
  id: T
  label: string
  icon: ReactNode
  content: ReactNode
}
