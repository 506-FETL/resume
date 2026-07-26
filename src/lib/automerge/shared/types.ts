export interface CollaborationCallbacks {
  onPeerJoin?: (payload: { peerId: string, metadata?: Record<string, any> }) => void
  onPeerLeave?: (payload: { peerId: string }) => void
  onChannelReady?: (channelName: string) => void
  onControlMessage?: (payload: { type: string, data?: Record<string, any> }) => void
  presenceMetadata?: Record<string, any>
}

export interface DocumentSaveResult {
  success: boolean
  error?: unknown
}
