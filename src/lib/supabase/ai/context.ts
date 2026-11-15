import type { AiMessage } from '@/lib/ai/types'
import supabase from '../client'
import { getCurrentUser } from '../user'

export interface ContextCheckpoint {
  conversation_id: string
  user_id: string
  boundary_message_id: string
  boundary_created_at: string
  summary: string
  source_fingerprint: string
  estimated_tokens: number
}

export async function readContextCheckpoint(
  conversationId: string,
  signal: AbortSignal,
): Promise<ContextCheckpoint | null> {
  const { data, error } = await supabase
    .from('ai_context_checkpoints')
    .select(
      'conversation_id,user_id,boundary_message_id,boundary_created_at,summary,source_fingerprint,estimated_tokens',
    )
    .eq('conversation_id', conversationId)
    .abortSignal(signal)
    .maybeSingle()

  if (error) throw error

  return data as ContextCheckpoint | null
}

export async function saveContextCheckpoint(
  conversationId: string,
  boundary: AiMessage,
  summary: string,
  sourceFingerprint: string,
  estimatedTokens: number,
  signal: AbortSignal,
) {
  const user = await getCurrentUser()

  if (!user) throw new Error('请登录后继续对话')

  const { error } = await supabase
    .from('ai_context_checkpoints')
    .upsert({
      conversation_id: conversationId,
      user_id: user.id,
      boundary_message_id: boundary.id,
      boundary_created_at: boundary.createdAt,
      summary,
      source_fingerprint: sourceFingerprint,
      estimated_tokens: estimatedTokens,
      updated_at: new Date().toISOString(),
    })
    .abortSignal(signal)

  if (error) throw error
}
