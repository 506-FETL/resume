export interface ContextCompactionEvent {
  phase: 'start' | 'complete' | 'failed'
  scope: 'history' | 'step'
  messageCount: number
  estimatedTokens: number
  boundaryMessageId?: string
  durationMs?: number
  fallback?: boolean
}

export interface ContextOptions {
  onCompaction?: (event: ContextCompactionEvent) => void
  skipCompaction?: boolean
}
