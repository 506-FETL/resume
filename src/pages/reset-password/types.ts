import type { Session } from '@supabase/supabase-js'

export type RecoveryStatus =
  | 'checking'
  | 'idle'
  | 'ready'
  | 'invalid'
  | 'success'
export interface RecoveryIdentity {
  userId: string
  sessionId: string
  session: Session
}
