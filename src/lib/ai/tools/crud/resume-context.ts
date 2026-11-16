import type { ResumeType } from '@/lib/schema'
import { updateConversationResumeBinding } from '@/lib/supabase/ai'
import useAssistantStore from '@/pages/assistant/store'
import { FORM_DATA_KEYS } from '@/store/resume'
import useUserStore from '@/store/user'

// 兼容历史 AI 调用的类型值；正式模板入口当前统一使用默认模板。
export const RESUME_TYPES: ResumeType[] = ['default', 'modern', 'simple']

// 把简历绑定到当前会话：更新内存态（画布预览即时切换）并持久化，
// 使助手画布预览跟随每个会话正在查看/修改的简历，而非全局当前简历。
export function bindResumeToActiveConversation(
  resumeId: string,
  target?: import('../../agent/tool-registry').AgentToolContext['target'],
): void {
  const { activeConversationId, conversations, upsertConversation } =
    useAssistantStore.getState()

  const conversationId = target?.conversationId ?? activeConversationId

  if (target) target.resumeId = resumeId
  if (target && useUserStore.getState().currentUser?.id !== target.ownerId)
    return

  if (!conversationId) return

  const conversation = conversations.find((c) => c.id === conversationId)

  if (conversation && conversation.resumeId !== resumeId)
    upsertConversation({ ...conversation, resumeId })

  updateConversationResumeBinding(conversationId, resumeId).catch(() => {
    // 持久化失败静默：内存态已更新，切设备时回退到全局当前简历
  })
}

export function normalizeResumeType(value: unknown): ResumeType {
  return RESUME_TYPES.includes(value as ResumeType)
    ? (value as ResumeType)
    : 'default'
}

// 从模型给的 sections 里挑出合法模块列，作为 resume_config 的初始内容列写入。
// 简历正文首次打开时会以 resume_config 行的这些列 seed 到 Automerge 文档，因此可直接落库。
export function pickSectionColumns(sections: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {}

  if (!sections || typeof sections !== 'object') return out

  for (const key of FORM_DATA_KEYS) {
    const value = (sections as Record<string, unknown>)[key]

    if (value !== undefined && value !== null) out[key] = value
  }

  return out
}
