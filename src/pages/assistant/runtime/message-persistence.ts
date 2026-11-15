import type { AiMessage } from '@/lib/ai/types'
import { toast } from 'sonner'
import { updateMessage } from '@/lib/supabase/ai'
import useUserStore from '@/store/user'
import useAssistantStore from '../store'
import {
  getDraftRecoveryEpoch,
  updateConversationDraft,
} from '../store/composer-sessions'

export async function persistAssistantMessageUpdate(
  message: AiMessage,
  recoveryEpoch = getDraftRecoveryEpoch(message.userId),
): Promise<boolean> {
  if (message.id.startsWith('local-') || message.id === 'streaming') return true

  try {
    if (useUserStore.getState().currentUser?.id !== message.userId)
      throw new Error('账户已切换，稍后回到原会话核对保存')

    await updateMessage(message.id, { parts: message.parts })

    return true
  } catch {
    updateConversationDraft(
      useAssistantStore,
      message.userId,
      message.conversationId,
      (draft) => ({
        pendingMessageUpdates: [
          ...draft.pendingMessageUpdates.filter(
            (pending) => pending.id !== message.id,
          ),
          message,
        ],
      }),
      recoveryEpoch,
    )

    toast.error('修改结果已保留，记录保存结果待核对', {
      description: '队列已暂停，继续时会先保存已有结果。',
    })

    return false
  }
}
