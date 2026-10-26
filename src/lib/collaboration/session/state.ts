import type {
  CollaborationActivationResult,
  CollaborationParticipant,
  CollaborationParticipantMetadata,
  CollaborationPhase,
  CollaborationSessionState,
} from './types'
import { getParticipantColor } from '../shared'

function readMetadataString(
  metadata: Record<string, unknown> | undefined,
  key: string,
) {
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
      readMetadataString(metadata, 'userName') ??
      readMetadataString(metadata, 'name') ??
      `协作者 ${peerId.slice(-4)}`,
    color: readMetadataString(metadata, 'color') ?? getParticipantColor(userId),
    role: readParticipantRole(metadata),
  }
}

export function createInitialCollaborationSessionState(): CollaborationSessionState {
  return {
    isSharing: false,
    isConnecting: false,
    phase: 'idle',
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
    commentProtocolVersion: null,
    shareEndedByRemote: false,
  }
}

function getCollaborationPhaseFlags(phase: CollaborationPhase) {
  return {
    isSharing: phase === 'connected' || phase === 'stopping',
    isConnecting:
      phase === 'authenticating' ||
      phase === 'authorizing' ||
      phase === 'hydrating' ||
      phase === 'connecting' ||
      phase === 'syncing' ||
      phase === 'stopping',
  }
}

type CollaborationPhaseOverrides = Partial<
  Omit<CollaborationSessionState, 'phase' | 'isSharing' | 'isConnecting'>
>

export function createCollaborationPhaseState(
  phase: CollaborationPhase,
  overrides: CollaborationPhaseOverrides = {},
): Partial<CollaborationSessionState> {
  return {
    ...overrides,
    phase,
    ...getCollaborationPhaseFlags(phase),
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

export function hasParticipantUser(
  participants: Record<string, CollaborationParticipant>,
  userId: string,
) {
  return Object.values(participants).some(
    (participant) => participant.metadata.userId === userId,
  )
}

export function getParticipantCount(
  participants: Record<string, CollaborationParticipant>,
) {
  return new Set(
    Object.values(participants).map(
      (participant) => participant.metadata.userId,
    ),
  ).size
}

export function createConnectedSessionState(
  result: CollaborationActivationResult,
  commentAuthorization: Pick<
    CollaborationSessionState,
    'commentAccess' | 'commentHostLeaseId' | 'commentProtocolVersion'
  > = {
    commentAccess: null,
    commentHostLeaseId: null,
    commentProtocolVersion: null,
  },
): Partial<CollaborationSessionState> {
  // 首轮发现早于连接完成，保留 adapter 已确认的成员，不能只留下自己。
  const participants = Object.fromEntries(
    result.peers.map(({ peerId, metadata }) => [
      peerId,
      createParticipant(peerId, metadata),
    ]),
  )

  const selfParticipant = result.self.peerId
    ? createParticipant(result.self.peerId, {
        userId: result.self.userId,
        userName: result.self.userName,
        color: result.self.color,
        role: result.role,
      })
    : null

  return createCollaborationPhaseState('connected', {
    role: result.role,
    sessionId: result.sessionId,
    shareUrl: result.shareUrl,
    resumeId: result.resumeId,
    roomName: result.roomName,
    participants: selfParticipant
      ? addParticipant(participants, selfParticipant)
      : participants,
    self: result.self,
    ...commentAuthorization,
    error: null,
    shareEndedByRemote: false,
  })
}

export function createStoppedSessionState(
  overrides: CollaborationPhaseOverrides & { phase?: CollaborationPhase } = {},
): Partial<CollaborationSessionState> {
  const { phase = 'idle', ...safeOverrides } = overrides

  return createCollaborationPhaseState(phase, {
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
    commentProtocolVersion: null,
    shareEndedByRemote: false,
    ...safeOverrides,
  })
}
