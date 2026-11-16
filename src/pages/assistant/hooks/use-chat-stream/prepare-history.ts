import type { AssistantSendTurn, SendLifecycle } from './types'
import { messageText } from './messages'
import type { AiMessage } from '@/lib/ai/types'
import { toast } from 'sonner'
import { createUserParts, getUserReferences } from '@/lib/ai/references'
import { freezeSourceScope } from '../../store/source-scope'
import { type AssistantRun } from '../../runtime/assistant-run'
import { listMessages, truncateMessages } from '@/lib/supabase/ai'
import useUserStore from '@/store/user'
import { getErrorMessage } from '@/utils'
import useAssistantStore, { cancelActiveAssistantRun } from '../../store'

export async function prepareSendHistory(
  truncateFrom: AiMessage,
  initialState: ReturnType<typeof useAssistantStore.getState>,
  execution: AssistantRun,
  lifecycle: SendLifecycle,
  turn: AssistantSendTurn,
) {
  const initialConversationId = initialState.activeConversationId!
  const initialUserId = execution.ownerId
  const controller = execution.controller
  const { ownsCurrentRun, finishConversationRun } = lifecycle
  const { localUser } = turn
  let { trimmed, references, frozenSources, userParts } = turn
  let identityChanged = false

  const unsubscribe = useUserStore.subscribe((state) => {
    if (state.currentUser?.id !== initialUserId) {
      identityChanged = true

      if (useAssistantStore.getState().abortController === controller)
        cancelActiveAssistantRun()
    }
  })

  try {
    let boundaryMessage = truncateFrom
    let history = initialState.messages
    let hasMore = initialState.hasMoreMessages

    // 当前页可能恰好从助手消息开始：在锁内补齐它对应的用户消息。
    while (boundaryMessage.role === 'assistant') {
      const page = await listMessages(initialConversationId, {
        before: history[0],
        limit: 30,
      })

      if (!ownsCurrentRun(initialConversationId)) {
        finishConversationRun()

        return null
      }

      history = [...page.messages, ...history]
      hasMore = page.hasMore

      const user = [...page.messages]
        .reverse()
        .find((message) => message.role === 'user')

      if (user) {
        boundaryMessage = user
        trimmed = messageText(user).trim()
        references = getUserReferences(user.parts)
        frozenSources = freezeSourceScope(
          user.parts.find((part) => part.type === 'source-scope')?.sources ??
            [],
          references,
        )
        userParts = [
          ...createUserParts(trimmed, references),
          {
            type: 'source-scope',
            sources: frozenSources,
            targetResumeId: execution.targetResumeId,
          },
        ]
        localUser.parts = userParts
      } else if (!page.hasMore) {
        throw new Error('未找到对应的用户消息')
      }
    }

    if (!trimmed && !references.length)
      throw new Error('用户消息为空，无法重新生成')

    await truncateMessages(
      initialConversationId,
      boundaryMessage.id,
      initialUserId,
    )

    const state = useAssistantStore.getState()

    const sameView =
      state.activeConversationId === initialConversationId &&
      state.conversationViewVersion === initialState.conversationViewVersion &&
      !identityChanged &&
      useUserStore.getState().currentUser?.id === initialUserId

    const canSend = ownsCurrentRun(initialConversationId) && sameView

    if (sameView) {
      const kept = history.slice(
        0,
        history.findIndex((message) => message.id === boundaryMessage.id),
      )

      useAssistantStore.setState({
        messages: canSend ? [...kept, localUser] : kept,
        hasMoreMessages: hasMore,
        // 已删除边界仍可作为严格小于的游标，继续加载更早的历史。
        oldestMessageCursor: {
          createdAt: (kept[0] ?? boundaryMessage).createdAt,
          id: (kept[0] ?? boundaryMessage).id,
        },
        targetMessageId: null,
      })
    }
    if (!canSend) {
      finishConversationRun()

      return null
    }
  } catch (error) {
    if (ownsCurrentRun(initialConversationId)) {
      useAssistantStore.setState({
        streaming: false,
        abortController: null,
      })

      toast.error('更新历史失败', { description: getErrorMessage(error) })
    }

    finishConversationRun()

    return null
  } finally {
    unsubscribe()
  }

  return { trimmed, references, frozenSources, userParts, localUser }
}
