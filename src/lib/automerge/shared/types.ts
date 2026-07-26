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
