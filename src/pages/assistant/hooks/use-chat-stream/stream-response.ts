import type {
  AssistantSendTurn,
  SentConversation,
  SendLifecycle,
} from './types'
import { prepareRunSources } from './prepare-sources'
import type { AiMessage, AiMessagePart } from '@/lib/ai/types'
import { toast } from 'sonner'
import { buildUserContext, runAgent } from '@/lib/ai/agent'
import { referenceLabel } from '@/lib/ai/references'
import type { ContextCompactionEvent } from '@/lib/ai/agent/context-events'
import {
  recordAssistantRunCompaction,
  recordAssistantRunToolResult,
} from '../../runtime/assistant-run'
import { type AssistantRun } from '../../runtime/assistant-run'
import { updateConversationDraft } from '../../store/composer-sessions'
import { prepareConversationContext } from '@/lib/ai/agent/conversation-context'
import { createCitationEvidenceRetainer } from '@/lib/ai/agent/retain-citation-evidence'
import { QuotaExceededError } from '@/lib/llm/call'
import {
  insertMessage,
  touchConversation,
  updateConversation,
} from '@/lib/supabase/ai'
import { refetchAiQuota } from '@/store/ai-quota'
import { openUpgradeDialog } from '@/store/upgrade-dialog'
import { getErrorMessage } from '@/utils'
import { CONVERSATION_TITLE_MAX_LEN } from '../../const'
import useAssistantStore from '../../store'

export async function streamAssistantResponse(
  execution: AssistantRun,
  turn: AssistantSendTurn,
  conversation: SentConversation,
  lifecycle: SendLifecycle,
): Promise<'complete' | 'interrupted' | 'paused'> {
  const { trimmed, references, frozenSources } = turn

  const { conversationId, isNewConversation, assistantMessageId, thinking } =
    conversation

  const { ownsView, ownsCurrentRun, finishConversationRun, recoveryEpoch } =
    lifecycle

  const controller = execution.controller
  const initialUserId = execution.ownerId
  // 4. SDK 组装消息快照，页面只负责合帧与持久化。
  let draft: AiMessagePart[] = []
  // 用 requestAnimationFrame 合帧：高频 token 回调在一帧内只触发一次 store 更新，避免逐 token 重渲染卡顿
  let rafId: number | null = null

  const pushDraft = () => {
    if (rafId != null) return

    rafId = requestAnimationFrame(() => {
      rafId = null

      if (useAssistantStore.getState().abortController === controller)
        useAssistantStore.getState().setStreamingParts([...draft])
    })
  }

  const cancelPushDraft = () => {
    if (rafId != null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  let finalUsage: { input: number; output: number; total: number } | null = null

  const toolStates = new Map<string, string>()

  let attemptedFinalParts: AiMessagePart[] | null = null
  let assistantSaved = false
  let persistenceUnknown = false

  const onCompaction = (event: ContextCompactionEvent) => {
    recordAssistantRunCompaction(event)

    if (ownsCurrentRun(conversationId))
      useAssistantStore.setState({
        runPhase: event.phase === 'start' ? 'compacting' : 'generating',
      })
  }

  try {
    const runSources = await prepareRunSources(
      frozenSources,
      references,
      conversationId,
      controller,
      ownsCurrentRun,
    )

    const [context, prepared] = await Promise.all([
      buildUserContext(execution.targetResumeId),
      prepareConversationContext(conversationId, controller.signal, {
        resumeId: execution.targetResumeId,
        sources: runSources,
        onCompaction,
      }),
    ])

    useAssistantStore.setState({ runPhase: 'generating' })

    if (controller.signal.aborted)
      throw new DOMException('aborted', 'AbortError')

    const retainCitations = createCitationEvidenceRetainer(
      prepared.messages,
      prepared.sources,
    )

    const generatedParts = await runAgent({
      history: prepared.messages,
      summary: prepared.summary,
      skipCompaction: prepared.compactionFailed,
      sources: prepared.sources,
      conversationId,
      signal: controller.signal,
      thinking,
      context,
      target: {
        resumeId: execution.targetResumeId,
        conversationId,
        ownerId: initialUserId,
      },
      callbacks: {
        onCompaction,
        onParts: (parts) => {
          for (const part of parts) {
            if (
              part.type !== 'tool-call' ||
              toolStates.get(part.toolCallId) === part.state
            )
              continue

            toolStates.set(part.toolCallId, part.state)

            recordAssistantRunToolResult({
              toolName: part.toolName,
              state: part.state,
              toolCallId: part.toolCallId,
            })
          }

          draft = retainCitations(parts)
          pushDraft()
        },
        onContextUsage: (usage) => {
          draft = [
            ...draft.filter((part) => part.type !== 'context-usage'),
            usage,
          ]

          pushDraft()
        },
        onUsage: (usage) => {
          finalUsage = usage

          if (useAssistantStore.getState().abortController === controller)
            useAssistantStore.getState().setStreamingUsage(usage)
        },
      },
    })

    const finalParts = retainCitations(generatedParts)

    // 5. 落库 assistant 消息（整轮完整 parts），原子关闭 streaming（避免双气泡）
    if (controller.signal.aborted)
      throw new DOMException('aborted', 'AbortError')

    attemptedFinalParts = finalParts
    useAssistantStore.setState({ runPhase: 'saving' })

    const assistantMessage = await insertMessage(conversationId, {
      id: assistantMessageId,
      role: 'assistant',
      parts: finalParts,
    })

    assistantSaved = true

    const current = useAssistantStore.getState()

    if (
      ownsView() &&
      current.activeConversationId === conversationId &&
      (!current.abortController || current.abortController === controller)
    ) {
      cancelPushDraft()

      if (finalUsage)
        useAssistantStore
          .getState()
          .setUsageForMessage(assistantMessage.id, finalUsage)
      if (current.abortController === controller) {
        useAssistantStore.setState((state) => ({
          messages: [...state.messages, assistantMessage],
          streaming: false,
          streamingText: '',
          streamingParts: [],
          streamingUsage: null,
          abortController: null,
        }))
      } else {
        current.appendMessage(assistantMessage)
      }
    }

    finishConversationRun()

    // 6. 刷新排序；首条消息生成标题
    if (isNewConversation) {
      const title = (
        trimmed || references.map(referenceLabel).join('、')
      ).slice(0, CONVERSATION_TITLE_MAX_LEN)

      const updated = await updateConversation(conversationId, { title })

      if (ownsView()) useAssistantStore.getState().upsertConversation(updated)
    } else {
      await touchConversation(conversationId)
    }

    // 7. 本轮成功：以服务端权威额度校正各展示位（composer / 账户菜单 / 用户中心）
    refetchAiQuota()

    return 'complete'
  } catch (error) {
    cancelPushDraft()

    // 停止/失败仍保留已经发生的技能和工具活动，且不写入后来切换的新会话。
    if (!assistantSaved && draft.length > 0) {
      const interrupted: AiMessagePart[] =
        attemptedFinalParts ??
        draft.map((part) => {
          if (
            part.type === 'tool-call' &&
            (part.state === 'call' || part.state === 'awaiting-confirm')
          )
            return {
              ...part,
              state: 'cancelled',
              result: {
                cancelled: true,
                message: '本轮已停止，工具未完成。',
              },
            }
          if (part.type === 'skill-activity' && part.state === 'loading')
            return { ...part, state: 'error', error: '加载已停止' }

          return part
        })

      if (!attemptedFinalParts)
        interrupted.push({
          type: 'text',
          text: controller.signal.aborted
            ? '已停止本次回复，以上为已完成的进展。'
            : `本次回复未完成：${getErrorMessage(error)}`,
        })

      try {
        if (attemptedFinalParts) throw error

        const saved = await insertMessage(conversationId, {
          id: assistantMessageId,
          role: 'assistant',
          parts: interrupted,
        })

        const state = useAssistantStore.getState()

        if (
          ownsView() &&
          state.activeConversationId === conversationId &&
          (!state.abortController || state.abortController === controller)
        )
          state.appendMessage(saved)
      } catch {
        persistenceUnknown = true

        const pending: AiMessage = {
          id: assistantMessageId,
          conversationId,
          userId: initialUserId!,
          role: 'assistant',
          parts: interrupted,
          createdAt: new Date().toISOString(),
        }

        updateConversationDraft(
          useAssistantStore,
          initialUserId!,
          conversationId,
          () => ({ pendingAssistantWrite: pending }),
          recoveryEpoch,
        )

        const state = useAssistantStore.getState()

        if (ownsView() && state.activeConversationId === conversationId)
          state.appendMessage(pending)

        toast.error('回复保存结果待核对，队列已暂停。继续时会先保存已有进展。')
      }
    }
    if ((error as Error)?.name !== 'AbortError') {
      // 额度超限：打开升级占位 Dialog（携带恢复时间），并以服务端额度校正展示位
      if (error instanceof QuotaExceededError) {
        openUpgradeDialog({
          reason: 'quota_exceeded',
          resetAt: error.resetAt ?? null,
        })

        refetchAiQuota()
      } else {
        toast.error('回复失败', { description: getErrorMessage(error) })
      }
    }
    if (useAssistantStore.getState().abortController === controller) {
      cancelPushDraft()

      useAssistantStore.setState({
        streaming: false,
        streamingText: '',
        streamingParts: [],
        streamingUsage: null,
        abortController: null,
      })
    }

    finishConversationRun()

    return persistenceUnknown
      ? 'paused'
      : controller.signal.aborted
        ? 'interrupted'
        : 'paused'
  }
}
