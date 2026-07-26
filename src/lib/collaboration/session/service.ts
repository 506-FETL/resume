import type { CreateSessionCallbacks, SessionActivationOptions } from './types'
import { buildCollaborationRoomName, buildCollaborationShareUrl, createParticipantColor } from '../shared'

interface EnableSessionOptions extends SessionActivationOptions {
  createCallbacks: CreateSessionCallbacks
  getDocumentManager: () => {
    enableCollaboration: (sessionId: string, callbacks: any) => Promise<{ peerId?: string }>
    getHandle: () => unknown
    getDocumentUrl: () => string | null
    saveToSupabase: (handle: any) => Promise<void>
  } | null
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

  const color = createParticipantColor(userId)
  setState({ isConnecting: true, error: null, selfColor: color })

  const adapterPeerIdRef = { current: null as string | null }
  const callbacks = createCallbacks({
    role,
    userId,
    userName,
    color,
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
    userId,
    userName,
    role,
    color,
    shareUrl: buildCollaborationShareUrl(
      resumeId,
      sessionId,
      docManager.getDocumentUrl() || undefined,
    ),
    roomName: buildCollaborationRoomName(resumeId, sessionId),
    selfPeerId: adapterPeerIdRef.current,
  }
}
