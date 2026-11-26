import type { AiConversation } from '@/lib/ai/types'

export const SUMMARY_FIELDS = 'id,user_id,title,resume_id,created_at,updated_at'

// 行 → camelCase 映射
export function mapConversation(row: any): AiConversation {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    resumeId: row.resume_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
