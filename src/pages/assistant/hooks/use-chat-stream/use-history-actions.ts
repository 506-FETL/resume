import type { useQueueDrain } from './use-queue-drain'
import type { useRunSend } from './use-run-send'
import { interruption } from './interruption'
import { messageText } from './messages'
import type { AiMessage, AiUserReference } from '@/lib/ai/types'
import { useCallback } from 'react'
import { toast } from 'sonner'
import { createSkillReferences } from '@/lib/ai/skills/references'
import { getUserReferences, uniqueReferences } from '@/lib/ai/references'
import type { AssistantSubmission } from '../../store/composer-slice'
import { resolveActiveResumeId } from '@/lib/ai/active-resume'
import { freezeSourceScope, peekSourceScope } from '../../store/source-scope'
import { assistantRunner as runner } from '../../runtime/assistant-run'
import useUserStore from '@/store/user'
import { getErrorMessage } from '@/utils'
import useAssistantStore from '../../store'

export function useHistoryActions(
  runSend: ReturnType<typeof useRunSend>,
  drainQueue: ReturnType<typeof useQueueDrain>,
) {
  const runHistory = useCallback(
    (
      text: string,
      references: AiUserReference[],
      boundary: AiMessage,
      historicalScope = true,
    ) => {
      const state = useAssistantStore.getState()
      const ownerId = useUserStore.getState().currentUser?.id

      if (runner.busy || !ownerId) return
      if (state.pendingAssistantWrite || state.pendingMessageUpdates.length) {
        toast.error('请先继续核对并保存已有修改，再重新生成。')

        return
      }

      const targetResumeId = resolveActiveResumeId()

      const savedScope = boundary.parts.find(
        (part) => part.type === 'source-scope',
      )

      const explicitSources = freezeSourceScope([], references)

      const sources = historicalScope
        ? (savedScope?.sources ?? freezeSourceScope([], references))
        : explicitSources.length
          ? explicitSources
          : peekSourceScope({
              ownerId,
              conversationId: state.activeConversationId,
              resumeId: targetResumeId,
              scopeRevision: state.sourceScopeRevision,
            })

      if (!sources) {
        toast.error('资料范围尚未读取完成，请稍后再试。')

        return
      }

      const submission: AssistantSubmission = {
        id: crypto.randomUUID(),
        ownerId,
        conversationId: state.activeConversationId,
        text,
        references,
        thinking: state.deepThinking,
        createdAt: new Date().toISOString(),
        targetResumeId,
        sources: freezeSourceScope(sources, references),
      }

      runner
        .start(async () => {
          const outcome = await runSend(text, references, boundary, submission)

          if (
            outcome === 'paused' ||
            (outcome === 'interrupted' &&
              !interruption.continueAfterInterruption)
          )
            useAssistantStore.setState({ queuePaused: true })

          interruption.continueAfterInterruption = false
        })
        .catch((error) => {
          useAssistantStore.setState({ queuePaused: true })
          toast.error('发送已暂停', { description: getErrorMessage(error) })
        })
        .finally(() => {
          if (!useAssistantStore.getState().queuePaused) drainQueue()
        })
    },
    [drainQueue, runSend],
  )

  // 重试：移除最后一条助手消息（若有），以最后一条用户消息重新发送
  const retryLast = useCallback(() => {
    const {
      messages,
      streaming,
      activeConversationId,
      inFlightConversationIds,
    } = useAssistantStore.getState()

    if (
      streaming ||
      (activeConversationId && inFlightConversationIds[activeConversationId]) ||
      messages.length === 0
    )
      return

    let lastUser: AiMessage | null = null

    // 从后往前定位用户消息，持久截断和重新追加统一由 runSend 执行。
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUser = messages[i]
        break
      }
    }

    if (!lastUser) {
      const lastAssistant = [...messages]
        .reverse()
        .find((message) => message.role === 'assistant')

      if (lastAssistant) runHistory('', [], lastAssistant)

      return
    }

    runHistory(
      messageText(lastUser).trim(),
      getUserReferences(lastUser.parts),
      lastUser,
    )
  }, [runHistory])

  // 针对指定助手消息重新生成：截断其对应的上一条用户消息及之后所有消息，用该用户消息重跑
  const regenerateFrom = useCallback(
    (assistantMessageId: string) => {
      const {
        messages,
        streaming,
        activeConversationId,
        inFlightConversationIds,
      } = useAssistantStore.getState()

      if (
        streaming ||
        (activeConversationId && inFlightConversationIds[activeConversationId])
      )
        return

      const ai = messages.findIndex(
        (m) => m.id === assistantMessageId && m.role === 'assistant',
      )

      if (ai < 0) return

      // 找到该助手消息前最近的一条用户消息
      let ui = -1

      for (let i = ai - 1; i >= 0; i--) {
        if (messages[i].role === 'user') {
          ui = i
          break
        }
      }

      if (ui < 0) {
        runHistory('', [], messages[ai])

        return
      }

      const userText = messageText(messages[ui]).trim()

      if (!userText && !getUserReferences(messages[ui].parts).length) return

      runHistory(userText, getUserReferences(messages[ui].parts), messages[ui])
    },
    [runHistory],
  )

  // 编辑历史用户消息后重新生成：截断该用户消息及之后的所有消息，用新文本重跑
  const editUserMessageAndRerun = useCallback(
    (
      userMessageId: string,
      newText: string,
      selectedReferences?: AiUserReference[],
    ) => {
      const {
        messages,
        streaming,
        activeConversationId,
        inFlightConversationIds,
      } = useAssistantStore.getState()

      if (
        streaming ||
        (activeConversationId && inFlightConversationIds[activeConversationId])
      )
        return

      const trimmed = newText.trim()

      const ui = messages.findIndex(
        (m) => m.id === userMessageId && m.role === 'user',
      )

      if (ui < 0) return

      const selected =
        selectedReferences ?? getUserReferences(messages[ui].parts)

      if (!trimmed && !selected.length) return

      try {
        const references = uniqueReferences([
          ...selected,
          ...createSkillReferences(trimmed),
        ])

        runHistory(trimmed, references, messages[ui], false)
      } catch (error) {
        toast.error('无法调用技能', { description: getErrorMessage(error) })
      }
    },
    [runHistory],
  )

  return { retryLast, regenerateFrom, editUserMessageAndRerun }
}
