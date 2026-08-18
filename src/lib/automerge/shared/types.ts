export interface CollaborationCallbacks {
  onPeerJoin?: (payload: { peerId: string, metadata?: Record<string, unknown> }) => void
  onPeerLeave?: (payload: { peerId: string }) => void
  onChannelReady?: (channelName: string) => void
  onControlMessage?: (payload: { type: string, data?: Record<string, unknown> }) => void
  presenceMetadata?: Record<string, unknown>
}

export interface DocumentSaveResult {
  success: boolean
  error?: unknown
}

export type DocumentInitializationSource
  = | { kind: 'owner' }
    | {
      kind: 'collaboration'
      documentUrl: string
      documentData: string
      sessionId: string
    }

export class CollaborationDocumentLoadError extends Error {
  readonly code = 'collaboration_document_invalid'

  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'CollaborationDocumentLoadError'
  }
}
