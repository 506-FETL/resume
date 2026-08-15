import type { CollaborationActivationResult, CollaborationParticipant, CollaborationParticipantMetadata, CollaborationSessionState } from './types'
import { getParticipantColor } from '../shared'

function readMetadataString(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function readParticipantRole(metadata: Record<string, unknown> | undefined) {
  const role = metadata?.role
  return role === 'host' || role === 'guest' ? role : null
}

export function normalizeParticipantMetadata(
  peerId: string,
  metadata?: Record<string, unknown>,
): CollaborationParticipantMetadata {
  const userId = readMetadataString(metadata, 'userId') ?? peerId

  return {
    userId,
    userName:
      readMetadataString(metadata, 'userName')
      ?? readMetadataString(metadata, 'name')
      ?? `协作者 ${peerId.slice(-4)}`,
    color: readMetadataString(metadata, 'color') ?? getParticipantColor(userId),
    role: readParticipantRole(metadata),
  }
}

export function createInitialCollaborationSessionState(): CollaborationSessionState {
  return {
    isSharing: false,
    isConnecting: false,
    connectionPhase: null,
    role: null,
    sessionId: null,
    shareUrl: null,
    resumeId: null,
    roomName: null,
    participants: {},
    error: null,
    self: null,
    commentAccess: null,
    commentHostLeaseId: null,
    shareEndedByRemote: false,
  }
}

export function createParticipant(
  peerId: string,
  metadata?: Record<string, unknown>,
): CollaborationParticipant {
  return {
    peerId,
    metadata: normalizeParticipantMetadata(peerId, metadata),
  }
}

export function addParticipant(
  participants: Record<string, CollaborationParticipant>,
  participant: CollaborationParticipant,
) {
  return {
    ...participants,
    [participant.peerId]: participant,
  }
}

export function removeParticipant(
  participants: Record<string, CollaborationParticipant>,
  peerId: string,
) {
  if (!(peerId in participants)) {
    return participants
  }

  const next = { ...participants }
  delete next[peerId]
  return next
}

export function createConnectedSessionState(
  result: CollaborationActivationResult,
  commentAuthorization: Pick<
    CollaborationSessionState,
    'commentAccess' | 'commentHostLeaseId'
  > = { commentAccess: null, commentHostLeaseId: null },
): Partial<CollaborationSessionState> {
  const selfParticipant = result.self.peerId
    ? createParticipant(result.self.peerId, {
        userId: result.self.userId,
        userName: result.self.userName,
        color: result.self.color,
        role: result.role,
      })
    : null

  return {
    isSharing: true,
    isConnecting: false,
    connectionPhase: null,
    role: result.role,
    sessionId: result.sessionId,
    shareUrl: result.shareUrl,
    resumeId: result.resumeId,
    roomName: result.roomName,
    participants: selfParticipant ? { [selfParticipant.peerId]: selfParticipant } : {},
    self: result.self,
    ...commentAuthorization,
    error: null,
    shareEndedByRemote: false,
  }
}

export function createStoppedSessionState(
  overrides: Partial<CollaborationSessionState> = {},
): Partial<CollaborationSessionState> {
  return {
    isSharing: false,
    isConnecting: false,
    connectionPhase: null,
    role: null,
    sessionId: null,
    shareUrl: null,
    resumeId: null,
    roomName: null,
    participants: {},
    error: null,
    self: null,
    commentAccess: null,
    commentHostLeaseId: null,
    shareEndedByRemote: false,
    ...overrides,
  }
}
