import type { AiConversation, AiConversationSearchResult } from '@/lib/ai/types'
import supabase from '../client'
import { getCurrentUser } from '../user'

// 行 → camelCase 映射
function mapConversation(row: any): AiConversation {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapConversationSearchResult(row: any): AiConversationSearchResult {
  if (row.role !== null && row.role !== 'user' && row.role !== 'assistant')
    throw new Error('搜索结果包含未知消息角色')
  if (row.match_type !== 'title' && row.match_type !== 'message')
    throw new Error('搜索结果包含未知命中类型')

  return {
    conversationId: row.conversation_id,
    conversationTitle: row.conversation_title,
    messageId: row.message_id ?? null,
    excerpt: row.excerpt ?? '',
    role: row.role,
    matchedAt: row.matched_at,
    conversationUpdatedAt: row.conversation_updated_at,
    matchType: row.match_type,
    relevance: Number(row.relevance) || 0,
  }
}

interface SearchConversationOptions {
  query: string
  limit?: number
  offset?: number
  signal?: AbortSignal
}

export async function listConversations(): Promise<AiConversation[]> {
  const user = await getCurrentUser()
  if (!user)
    throw new Error('用户未登录')

  const { data, error } = await supabase
    .from('ai_conversations')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (error)
    throw error
  return (data || []).map(mapConversation)
}

export async function createConversation(title = '新对话'): Promise<AiConversation> {
  const user = await getCurrentUser()
  if (!user)
    throw new Error('用户未登录')

  const { data, error } = await supabase
    .from('ai_conversations')
    .insert({ user_id: user.id, title })
    .select()
    .single()

  if (error)
    throw error
  return mapConversation(data)
}

export async function updateConversation(
  id: string,
  patch: { title?: string },
): Promise<AiConversation> {
  const user = await getCurrentUser()
  if (!user)
    throw new Error('用户未登录')

  const { data, error } = await supabase
    .from('ai_conversations')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error)
    throw error
  return mapConversation(data)
}

// 触碰 updated_at，使该会话在列表回到顶部（写完消息后调用）
export async function touchConversation(id: string): Promise<void> {
  const user = await getCurrentUser()
  if (!user)
    throw new Error('用户未登录')

  const { error } = await supabase
    .from('ai_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error)
    throw error
}

export async function deleteConversation(id: string): Promise<void> {
  const user = await getCurrentUser()
  if (!user)
    throw new Error('用户未登录')

  const { error } = await supabase
    .from('ai_conversations')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error)
    throw error
}

export async function searchConversations({
  query,
  limit = 20,
  offset = 0,
  signal,
}: SearchConversationOptions): Promise<AiConversationSearchResult[]> {
  let request = supabase.rpc('search_ai_conversations', {
    p_search_query: query,
    p_result_limit: limit,
    p_result_offset: offset,
  })

  if (signal)
    request = request.abortSignal(signal)

  const { data, error } = await request
  if (error)
    throw error

  return (data || []).map(mapConversationSearchResult)
}

export function isConversationSearchUnavailable(error: unknown): boolean {
  const candidate = error as { code?: string, message?: string }
  return candidate.code === 'PGRST202'
    || candidate.message?.includes('search_ai_conversations') === true
}
