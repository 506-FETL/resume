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

export interface ListMessagesResult {
  messages: AiMessage[]
  hasMore: boolean
}

export type MessageCursor = Pick<AiMessage, 'createdAt' | 'id'>

// 默认取最新 limit 条（按 created_at 倒序取后在内存 reverse 为升序）；
// before 同时携带时间与 ID，避免同一时间的消息跨页时被跳过。
export async function listMessages(
  conversationId: string,
  options: { limit?: number, before?: MessageCursor } = {},
): Promise<ListMessagesResult> {
  const user = await getCurrentUser()
  if (!user)
    throw new Error('用户未登录')

  const limit = options.limit ?? 30
  let query = supabase
    .from('ai_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false }) // 同一 created_at 时以 id 做二级排序保证稳定性
    .limit(limit + 1) // 多取一条判断是否还有更早的

  if (options.before) {
    const { createdAt, id } = options.before
    query = query.or(`created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${id})`)
  }

  const { data, error } = await query
  if (error)
    throw error

  const rows = data || []
  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows
  // 倒序取回后 reverse 成升序（旧 → 新）
  const messages = page.map(mapMessage).reverse()
  return { messages, hasMore }
}

// 删除指定用户消息及其后的整个分支，边界由数据库解析，不受已加载页数影响。
export async function truncateMessages(conversationId: string, messageId: string, expectedUserId: string): Promise<void> {
  const { error } = await supabase.rpc('truncate_ai_messages', {
    p_conversation_id: conversationId,
    p_message_id: messageId,
    p_user_id: expectedUserId,
  })
  if (error)
    throw error
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
