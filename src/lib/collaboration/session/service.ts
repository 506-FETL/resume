import type { CreateSessionCallbacks, SessionActivationOptions } from './types'
import type { DocumentManager } from '@/lib/automerge'
import { buildCollaborationRoomName, buildCollaborationShareUrl, getParticipantColor } from '../shared'

interface EnableSessionOptions extends SessionActivationOptions {
  createCallbacks: CreateSessionCallbacks
  getDocumentManager: () => DocumentManager | null
}

export async function enableCollaborationSession(options: EnableSessionOptions) {
  const {
    sessionId,
    resumeId,
    userId,
    userName,
    role,
    shouldSaveSnapshot = false,
    getState,
    setState,
    createCallbacks,
    getDocumentManager,
  } = options

  const docManager = getDocumentManager()

  if (!docManager) {
    throw new Error('文档尚未初始化，无法开启协作')
  }

  const color = getParticipantColor(userId)
  const identity = { userId, userName, color }
  setState({ isConnecting: true, error: null })

  const adapterPeerIdRef = { current: null as string | null }
  const callbacks = createCallbacks({
    role,
    identity,
    getState,
    setState,
    adapterPeerIdRef,
  })

  const adapter = await docManager.enableCollaboration(sessionId, callbacks)
  adapterPeerIdRef.current = adapter.peerId || null

  if (shouldSaveSnapshot && docManager.getHandle()) {
    await docManager.saveToSupabase(docManager.getHandle())
  }

  return {
    sessionId,
    resumeId,
    role,
    self: {
      peerId: adapterPeerIdRef.current,
      ...identity,
    },
    shareUrl: buildCollaborationShareUrl(
      resumeId,
      sessionId,
      docManager.getDocumentUrl() || undefined,
    ),
    roomName: buildCollaborationRoomName(resumeId, sessionId),
  }
}
