import type useRichTextCollabStore from '../../richtext/store'
import type { CollaborationProtocolVersion } from '../types'

export interface CleanupSessionOptions {
  generation: number
  remote: boolean
  error?: string
}

export interface ActiveStopOperation {
  generation: number
  sessionId: string
  promise: Promise<void>
}

export interface ActiveHostStartOperation {
  resumeId: string
  userId: string
  promise: Promise<void>
}

export interface GuestMembershipIdentity {
  sessionId: string
  resumeId: string
  protocolVersion?: CollaborationProtocolVersion
  memberLeaseId?: string
}

export interface PendingGuestMembership extends GuestMembershipIdentity {
  generation: number
  memberLeaseId: string
}

export interface PendingHostAttempt {
  sessionId: string
  resumeId: string
  userId: string
  ownerGeneration: number
  status: 'active' | 'rolling_back' | 'retryable'
}

export type PendingHostAttemptIdentity = Omit<
  PendingHostAttempt,
  'ownerGeneration' | 'status'
>

export interface SessionRuntime {
  generation: number
  richTextStore: typeof useRichTextCollabStore | null
  stopLeaseMonitor: (() => void) | null
  pendingGuestMembership: PendingGuestMembership | null
}

export interface HostStartRuntime {
  pendingAttempt: PendingHostAttempt | null
  activeOperation: ActiveHostStartOperation | null
}
