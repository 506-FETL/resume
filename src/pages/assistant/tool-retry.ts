import type { AiMessage, AiMessagePart } from '@/lib/ai/types'
import { toast } from 'sonner'
import { getTool } from '@/lib/ai/agent'
import { createEvidenceTools } from '@/lib/ai/agent/evidence-tools'
import { getToolResultState } from '@/lib/ai/agent/to-message-parts'
import { getUserReferences } from '@/lib/ai/references'
import { getExperienceSourceMetadata } from '@/lib/experience-sources/api'
import { listMessages } from '@/lib/supabase/ai/messages'
import useUserStore from '@/store/user'
import useAssistantStore from './store'
import {
  getDraftRecoveryEpoch,
  getAssistantAccountGeneration,
} from './store/composer-sessions'
import {
  assistantRunner,
  executeAssistantRun,
  recordAssistantRunToolResult,
} from './runtime/assistant-run'
import { persistAssistantMessageUpdate } from './runtime/message-persistence'
import { freezeSourceScope } from './store/source-scope'

type ToolCallPart = Extract<AiMessagePart, { type: 'tool-call' }>

export async function retryToolCall(toolCallId: string): Promise<boolean> {
  const state = useAssistantStore.getState()
  const ownerId = useUserStore.getState().currentUser?.id

  const message = state.messages.find((item) =>
    item.parts.some(
      (part) => part.type === 'tool-call' && part.toolCallId === toolCallId,
    ),
  )

  const part = message?.parts.find(
    (item): item is ToolCallPart =>
      item.type === 'tool-call' && item.toolCallId === toolCallId,
  )

  if (!ownerId || !message || !part || part.state !== 'error') return false
  if (
    message.userId !== ownerId ||
    message.conversationId !== state.activeConversationId
  )
    return false
  if (
    assistantRunner.busy ||
    state.streaming ||
    state.runPhase !== 'idle' ||
    state.loadingMessages ||
    state.pendingAssistantWrite ||
    state.pendingMessageUpdates.length
  ) {
    toast.info('请先完成当前任务或核对保存结果，再重试工具')

    return false
  }

  const viewVersion = state.conversationViewVersion
  const recoveryEpoch = getDraftRecoveryEpoch(ownerId)
  let updatedMessage: AiMessage = message
  let canContinue = false

  await assistantRunner.start(() =>
    executeAssistantRun(
      {
        ownerId,
        recoveryEpoch,
        accountGeneration: getAssistantAccountGeneration(),
        conversationId: message.conversationId,
        submissionId: toolCallId,
        targetResumeId: part.targetResumeId ?? null,
        toolName: part.toolName,
      },
      async (run) => {
        const controller = run.controller
        let identityChanged = false

        const ownsView = () =>
          !identityChanged &&
          useUserStore.getState().currentUser?.id === ownerId &&
          getDraftRecoveryEpoch(ownerId) === recoveryEpoch &&
          useAssistantStore.getState().conversationViewVersion ===
            viewVersion &&
          useAssistantStore.getState().activeConversationId ===
            message.conversationId

        const unsubscribe = useUserStore.subscribe((current) => {
          if (current.currentUser?.id === ownerId) return

          identityChanged = true
          controller.abort()
        })

        const patch = (patch: Partial<ToolCallPart>) => {
          updatedMessage = {
            ...updatedMessage,
            parts: updatedMessage.parts.map((item) =>
              item.type === 'tool-call' && item.toolCallId === toolCallId
                ? { ...item, ...patch }
                : item,
            ),
          }

          if (ownsView())
            useAssistantStore
              .getState()
              .replaceMessage(message.id, updatedMessage)
        }

        if (!ownsView()) {
          unsubscribe()

          return
        }

        useAssistantStore.setState({
          abortController: controller,
          runPhase: 'preparing',
          pendingConfirm: null,
          queuePaused: true,
        })

        state.beginConversationRun(message.conversationId)
        patch({ state: 'call', result: undefined })

        try {
          const registered = getTool(part.toolName)

          const needsSources =
            part.toolName === 'search_experience_sources' ||
            part.toolName === 'read_experience_source'

          const targeted =
            registered?.policy.scope === 'target-resume' ||
            part.toolName === 'read_resume_preparation'

          const originalUser =
            needsSources || (targeted && part.targetResumeId === undefined)
              ? await readOriginalUserMessage(
                  message,
                  state.messages,
                  controller.signal,
                )
              : undefined

          const scope = originalUser?.parts.find(
            (item) => item.type === 'source-scope',
          )

          if (
            targeted &&
            part.targetResumeId === undefined &&
            scope?.targetResumeId === undefined
          )
            throw new Error('这条旧操作没有保存目标简历，请重新生成后再确认。')

          run.targetResumeId =
            part.targetResumeId !== undefined
              ? part.targetResumeId
              : (scope?.targetResumeId ?? null)

          const frozen = needsSources
            ? freezeSourceScope(
                scope?.sources ?? [],
                getUserReferences(originalUser?.parts ?? []),
              )
            : []

          const metadata = await Promise.all(
            Array.from({ length: Math.ceil(frozen.length / 100) }, (_, index) =>
              getExperienceSourceMetadata(
                frozen
                  .slice(index * 100, (index + 1) * 100)
                  .map((source) => source.sourceId),
                controller.signal,
              ),
            ),
          )

          const available = new Map(
            metadata
              .flatMap((result) => result.items)
              .map((source) => [source.id, source]),
          )

          const sources = frozen.filter(
            (source) => available.get(source.sourceId)?.status === 'ready',
          )

          const tool =
            registered ??
            createEvidenceTools(sources).find(
              (item) => item.name === part.toolName,
            )

          controller.signal.throwIfAborted()

          if (!tool) throw new Error('当前工具不可用，请重新生成这次操作')

          patch({ targetResumeId: run.targetResumeId })
          useAssistantStore.setState({ runPhase: 'generating' })

          const result = await tool.execute(
            (part.args ?? {}) as Record<string, unknown>,
            {
              signal: controller.signal,
              target: {
                resumeId: run.targetResumeId,
                conversationId: message.conversationId,
                ownerId,
              },
            },
          )

          patch({ result, state: getToolResultState(result) })

          recordAssistantRunToolResult({
            toolName: part.toolName,
            toolCallId,
            state: getToolResultState(result),
          })

          if (getToolResultState(result) === 'error')
            toast.error('重试仍失败，请查看工具结果')
        } catch (error) {
          const cancelled =
            error instanceof Error && error.name === 'AbortError'

          patch({
            result: cancelled
              ? { cancelled: true, message: '本轮已停止，工具未执行完成。' }
              : {
                  error:
                    error instanceof Error ? error.message : '工具执行失败',
                },
            state: cancelled ? 'cancelled' : 'error',
          })

          recordAssistantRunToolResult({
            toolName: part.toolName,
            toolCallId,
            state: cancelled ? 'cancelled' : 'error',
          })

          if (!cancelled) toast.error('重试失败，请查看工具结果')
        } finally {
          if (ownsView()) useAssistantStore.setState({ runPhase: 'saving' })

          const saved = await persistAssistantMessageUpdate(
            updatedMessage,
            recoveryEpoch,
          )

          canContinue = saved && !controller.signal.aborted && ownsView()
          unsubscribe()

          useAssistantStore
            .getState()
            .finishConversationRun(message.conversationId)

          if (
            useAssistantStore.getState().abortController === controller ||
            ownsView() ||
            (!useAssistantStore.getState().abortController &&
              !useAssistantStore.getState().streaming)
          ) {
            useAssistantStore.setState({
              abortController: null,
              runPhase: 'idle',
            })
          }
        }
      },
    ),
  )

  return canContinue
}

async function readOriginalUserMessage(
  message: AiMessage,
  loaded: AiMessage[],
  signal: AbortSignal,
): Promise<AiMessage | undefined> {
  const index = loaded.findIndex((item) => item.id === message.id)
  let history = loaded.slice(0, index)
  let user = [...history].reverse().find((item) => item.role === 'user')
  let cursor = history[0] ?? message

  while (!user) {
    const page = await listMessages(message.conversationId, {
      before: cursor,
      limit: 30,
      signal,
    })

    history = page.messages
    user = [...history].reverse().find((item) => item.role === 'user')

    if (user || !page.hasMore) return user

    cursor = history[0]
  }

  return user
}
