import type { AiMessage, AiMessagePart, AiMessageRole } from '@/lib/ai/types'
import supabase from '../client'
import { getCurrentUser } from '../user'

function mapMessage(row: any): AiMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    userId: row.user_id,
    role: row.role,
    parts: (row.parts || []) as AiMessagePart[],
    createdAt: row.created_at,
  }
}

export async function listMessages(conversationId: string): Promise<AiMessage[]> {
  const user = await getCurrentUser()
  if (!user)
    throw new Error('用户未登录')

  const { data, error } = await supabase
    .from('ai_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error)
    throw error
  return (data || []).map(mapMessage)
}

export async function insertMessage(
  conversationId: string,
  msg: { role: AiMessageRole, parts: AiMessagePart[] },
): Promise<AiMessage> {
  const user = await getCurrentUser()
  if (!user)
    throw new Error('用户未登录')

  const { data, error } = await supabase
    .from('ai_messages')
    .insert({
      conversation_id: conversationId,
      user_id: user.id,
      role: msg.role,
      parts: msg.parts,
    })
    .select()
    .single()

  if (error)
    throw error
  return mapMessage(data)
}

// 就地更新一条消息的 parts（用于工具重试后回写状态/结果、diff 撤销标记等持久化）
export async function updateMessage(
  messageId: string,
  patch: { parts: AiMessagePart[] },
): Promise<AiMessage> {
  const user = await getCurrentUser()
  if (!user)
    throw new Error('用户未登录')

  const { data, error } = await supabase
    .from('ai_messages')
    .update({ parts: patch.parts })
    .eq('id', messageId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error)
    throw error
  return mapMessage(data)
}
