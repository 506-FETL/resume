import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.103.0'
import type { RequestContext } from '../shared/request-context.ts'
import type { createQuotaLedger } from './ledger.ts'

export interface LLMProxyRequest {
  messages?: unknown
  model?: unknown
  response_format?: unknown
  temperature?: unknown
  stream?: unknown
  stream_options?: unknown
  max_tokens?: unknown
  tools?: unknown
  tool_choice?: unknown
  thinking?: unknown
  reasoning_effort?: unknown
}

export interface ReservationResult {
  ok?: boolean
  error?: string
  state?: string
  remaining?: number
  daily_limit?: number
  reset_at?: string
  unlimited?: boolean
  replayed?: boolean
}

export interface LedgerResult {
  ok?: boolean
  error?: string
}

export interface StreamUsage {
  promptTokens: number | null
  completionTokens: number | null
  totalTokens: number | null
}

export interface InspectedEvent {
  done: boolean
  meaningful: boolean
  upstreamRequestId: string | null
  finishReason: string | null
  usage: StreamUsage | null
}

export interface DeliveryContext {
  admin: SupabaseClient
  userId: string
  context: RequestContext
  reservationHeaders: Headers
  ledger: ReturnType<typeof createQuotaLedger>
  cleanupUpstream: () => void
}
