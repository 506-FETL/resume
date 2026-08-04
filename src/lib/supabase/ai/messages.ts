import type { AiMessage, AiMessagePart, AiMessageRole } from '@/lib/ai/types'
import supabase from '../client'
import { getCurrentUser } from '../user'

const CHAT_BUCKET = 'chat-uploads'

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

// 上传聊天图片到私有 bucket，返回对象路径（供存入消息 parts 的 image.path）
export async function uploadChatImage(
  conversationId: string,
  file: File,
): Promise<{ path: string }> {
  const user = await getCurrentUser()
  if (!user)
    throw new Error('用户未登录')

  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'png'
  const path = `${user.id}/${conversationId}/${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage
    .from(CHAT_BUCKET)
    .upload(path, file, { contentType: file.type || 'image/png', upsert: false })

  if (error)
    throw error
  return { path }
}

// 私有对象换签名 URL（渲染或发给模型时用）；默认 1 小时
export async function getSignedImageUrl(path: string, expiresInSeconds = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from(CHAT_BUCKET)
    .createSignedUrl(path, expiresInSeconds)

  if (error)
    throw error
  return data.signedUrl
}
