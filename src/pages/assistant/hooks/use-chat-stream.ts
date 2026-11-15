import type { AiMessage, AiMessagePart, AiUserReference } from '@/lib/ai/types'
import { useCallback } from 'react'
import { toast } from 'sonner'
import { buildUserContext, runAgent } from '@/lib/ai/agent'
import { createSkillReferences } from '@/lib/ai/skills/references'
import {
  getExperienceRelations,
  getExperienceSourceMetadata,
  setExperienceRelations,
} from '@/lib/experience-sources/api'
import {
  createUserParts,
  getUserReferences,
  uniqueReferences,
  referenceLabel,
} from '@/lib/ai/references'
import type { ContextCompactionEvent } from '@/lib/ai/agent/context-events'
import {
  recordAssistantRunCompaction,
  recordAssistantRunToolResult,
} from '../runtime/assistant-run'
import type { AssistantSubmission } from '../store/composer-slice'
import { resolveActiveResumeId } from '@/lib/ai/active-resume'
import { freezeSourceScope, peekSourceScope } from '../store/source-scope'
import {
  assistantRunner as runner,
  executeAssistantRun,
  type AssistantRun,
} from '../runtime/assistant-run'
import {
  getDraftRecoveryEpoch,
  getAssistantAccountGeneration,
  updateConversationDraft,
} from '../store/composer-sessions'
import { prepareConversationContext } from '@/lib/ai/agent/conversation-context'
import { QuotaExceededError } from '@/lib/llm/call'
import {
  createConversation,
  deleteConversation,
  insertMessage,
  listMessages,
  touchConversation,
  truncateMessages,
  updateConversation,
  updateMessage,
} from '@/lib/supabase/ai'
import { refetchAiQuota } from '@/store/ai-quota'
import { openUpgradeDialog } from '@/store/upgrade-dialog'
import useUserStore from '@/store/user'
import { getErrorMessage } from '@/utils'
import {
  CONVERSATION_TITLE_MAX_LEN,
  DEFAULT_CONVERSATION_TITLE,
} from '../const'
import useAssistantStore, { cancelActiveAssistantRun } from '../store'
import { writeLastConversationId } from '../utils'

// 构造一条本地临时消息（乐观上屏，稍后用服务端返回替换）
function makeLocalMessage(
  role: AiMessage['role'],
  parts: AiMessagePart[],
): AiMessage {
  return {
    id: `local-${crypto.randomUUID()}`,
    conversationId: '',
    userId: '',
    role,
    parts,
    createdAt: new Date().toISOString(),
  }
}

function messageText(message: AiMessage): string {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
}

let continueAfterInterruption = false

export function useChatStream() {
  // 核心发送：普通发送乐观上屏；历史重跑先持久截断，再落库 + 起流。
  const executeSend = useCallback(
    async (
      trimmed: string,
      references: AiUserReference[],
      truncateFrom: AiMessage | undefined,
      submission: AssistantSubmission | undefined,
      execution: AssistantRun,
    ): Promise<'complete' | 'interrupted' | 'paused'> => {
      if (!trimmed && !references.length && truncateFrom?.role !== 'assistant')
        return 'paused'

      const initialState = useAssistantStore.getState()
      const initialConversationId = initialState.activeConversationId
      const initialUserId = useUserStore.getState().currentUser?.id

      if (
        !initialUserId ||
        initialUserId !== execution.ownerId ||
        getAssistantAccountGeneration() !== execution.accountGeneration ||
        initialConversationId !== execution.conversationId
      )
        return 'paused'

      const recoveryEpoch = getDraftRecoveryEpoch(initialUserId)

      if (
        initialState.streaming ||
        initialState.loadingMessages ||
        initialState.loadingOlder ||
        (initialConversationId &&
          initialState.inFlightConversationIds[initialConversationId])
      )
        return 'paused'
      if (
        truncateFrom &&
        (!initialConversationId ||
          !initialUserId ||
          truncateFrom.conversationId !== initialConversationId ||
          truncateFrom.userId !== initialUserId)
      )
        return 'paused'

      // 1. 同步占用运行锁；重跑保留原消息，普通发送立即上屏。
      let frozenSources = freezeSourceScope(
        submission?.sources ?? [],
        references,
      )

      let userParts: AiMessagePart[] = [
        ...createUserParts(trimmed, references),
        {
          type: 'source-scope',
          sources: frozenSources,
          targetResumeId: execution.targetResumeId,
        },
      ]

      if (submission?.proposalId)
        userParts.push({
          type: 'revision',
          proposalId: submission.proposalId,
          feedback: trimmed,
        })

      const localUser = makeLocalMessage('user', userParts)
      const userMessageId = execution.submissionId
      const assistantMessageId = crypto.randomUUID()
      const controller = execution.controller
      let identityChanged = false

      const unsubscribeIdentity = useUserStore.subscribe((state) => {
        if (state.currentUser?.id !== initialUserId) {
          identityChanged = true
          controller.abort()
        }
      })

      execution.completion.finally(unsubscribeIdentity).catch(() => undefined)

      const ownsView = () =>
        !identityChanged &&
        getDraftRecoveryEpoch(initialUserId) === recoveryEpoch &&
        useUserStore.getState().currentUser?.id === initialUserId

      let lockedConversationId = initialConversationId

      const lockConversation = (id: string) => {
        lockedConversationId = id
        useAssistantStore.getState().beginConversationRun(id)
      }

      const finishConversationRun = () => {
        if (lockedConversationId) {
          useAssistantStore
            .getState()
            .finishConversationRun(lockedConversationId)

          lockedConversationId = null
        }
      }

      const ownsCurrentRun = (expectedConversationId?: string) => {
        const state = useAssistantStore.getState()

        return (
          ownsView() &&
          state.abortController === controller &&
          !controller.signal.aborted &&
          useUserStore.getState().currentUser?.id === initialUserId &&
          (!expectedConversationId ||
            state.activeConversationId === expectedConversationId)
        )
      }

      useAssistantStore.setState((state) => ({
        messages: truncateFrom
          ? state.messages
          : [...state.messages, localUser],
        streaming: true,
        pendingConfirm: null,
        runPhase: 'preparing',
        streamingText: '',
        streamingParts: [],
        streamingUsage: null,
        abortController: controller,
      }))

      if (initialConversationId) lockConversation(initialConversationId)

      // 重跑先持久截断；等待期间复用运行锁和取消令牌，失败不改历史。
      if (truncateFrom && initialConversationId && initialUserId) {
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

              return 'paused'
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
                user.parts.find((part) => part.type === 'source-scope')
                  ?.sources ?? [],
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
            state.conversationViewVersion ===
              initialState.conversationViewVersion &&
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

            return 'paused'
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

          return 'paused'
        } finally {
          unsubscribe()
        }
      }

      // 2. 后台确保会话存在
      let conversationId = initialConversationId
      let isNewConversation = false

      try {
        if (!conversationId) {
          const conv = await createConversation(DEFAULT_CONVERSATION_TITLE)

          if (
            controller.signal.aborted ||
            useAssistantStore.getState().abortController !== controller
          ) {
            await deleteConversation(conv.id).catch(() => undefined)

            if (useAssistantStore.getState().abortController === controller) {
              useAssistantStore.getState().removeMessage(localUser.id)

              useAssistantStore.setState({
                streaming: false,
                abortController: null,
              })
            }

            finishConversationRun()

            return controller.signal.aborted ? 'interrupted' : 'paused'
          }

          conversationId = conv.id
          execution.conversationId = conv.id
          isNewConversation = true
          lockConversation(conv.id)
          useAssistantStore.getState().upsertConversation(conv)
          useAssistantStore.getState().setActiveConversationId(conv.id)
          writeLastConversationId(conv.id)
        }
      } catch (error) {
        if (controller.signal.aborted) {
          if (useAssistantStore.getState().abortController === controller) {
            useAssistantStore.getState().removeMessage(localUser.id)

            useAssistantStore.setState({
              streaming: false,
              abortController: null,
            })
          }

          finishConversationRun()

          return 'interrupted'
        }

        if (ownsCurrentRun()) {
          useAssistantStore.getState().removeMessage(localUser.id)

          useAssistantStore.setState((state) => ({
            streaming: false,
            streamingText: '',
            streamingParts: [],
            abortController: null,
            queuePaused: true,
            queuedMessages: [
              {
                id: userMessageId,
                ownerId: initialUserId!,
                conversationId: null,
                text: trimmed,
                references,
                thinking: submission?.thinking ?? initialState.deepThinking,
                createdAt: submission?.createdAt ?? localUser.createdAt,
                targetResumeId: execution.targetResumeId,
                sources: frozenSources,
              },
              ...state.queuedMessages,
            ],
          }))

          toast.error('创建会话失败', { description: getErrorMessage(error) })
        }

        finishConversationRun()

        return 'paused'
      }

      // 3. 落库用户消息，用服务端行替换本地临时行
      try {
        const savedUser = await insertMessage(conversationId, {
          id: userMessageId,
          role: 'user',
          parts: userParts,
        })

        if (!ownsCurrentRun(conversationId)) {
          const state = useAssistantStore.getState()

          if (
            state.activeConversationId === conversationId &&
            useUserStore.getState().currentUser?.id === initialUserId &&
            (!state.abortController || state.abortController === controller)
          ) {
            state.replaceMessage(localUser.id, savedUser)

            if (state.abortController === controller)
              useAssistantStore.setState({
                streaming: false,
                streamingText: '',
                streamingParts: [],
                abortController: null,
              })
          }

          finishConversationRun()

          return controller.signal.aborted ? 'interrupted' : 'paused'
        }

        useAssistantStore.getState().replaceMessage(localUser.id, savedUser)
      } catch (error) {
        const state = useAssistantStore.getState()

        if (
          state.activeConversationId === conversationId &&
          useUserStore.getState().currentUser?.id === initialUserId
        ) {
          state.removeMessage(localUser.id)

          useAssistantStore.setState({
            streaming: false,
            streamingText: '',
            streamingParts: [],
            abortController: null,
          })
        }

        updateConversationDraft(
          useAssistantStore,
          initialUserId!,
          conversationId,
          (state) => ({
            queuedMessages: [
              {
                id: userMessageId,
                ownerId: initialUserId!,
                conversationId,
                text: trimmed,
                references,
                thinking: submission?.thinking ?? initialState.deepThinking,
                createdAt: submission?.createdAt ?? localUser.createdAt,
                targetResumeId: execution.targetResumeId,
                sources: frozenSources,
                proposalId: submission?.proposalId,
                status: 'unknown' as const,
              },
              ...state.queuedMessages,
            ],
          }),
          recoveryEpoch,
        )

        toast.error('暂时无法确认发送结果，消息已留在队列', {
          description: getErrorMessage(error),
        })

        finishConversationRun()

        return 'paused'
      }

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

      let finalUsage: { input: number; output: number; total: number } | null =
        null

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

      const thinking =
        submission?.thinking ?? useAssistantStore.getState().deepThinking

      try {
        const selectedSources = references
          .filter(
            (reference) =>
              reference.type === 'reference' && reference.kind === 'experience',
          )
          .map((reference) => ({
            sourceId: reference.id,
            versionId: reference.versionId,
            name: reference.label,
          }))

        if (selectedSources.length) {
          const existing = await getExperienceRelations({
            target: 'conversation',
            targetId: conversationId,
            signal: controller.signal,
          })

          const nextSources = [
            ...new Map(
              [...existing, ...selectedSources].map((source) => [
                source.sourceId,
                source,
              ]),
            ).values(),
          ]

          await setExperienceRelations({
            target: 'conversation',
            targetId: conversationId,
            references: nextSources,
            signal: controller.signal,
          })

          if (ownsCurrentRun(conversationId))
            useAssistantStore.setState((state) => ({
              sourceScopeRevision: state.sourceScopeRevision + 1,
            }))
        }

        const statuses = await Promise.all(
          Array.from(
            { length: Math.ceil(frozenSources.length / 100) },
            (_, index) =>
              getExperienceSourceMetadata(
                frozenSources
                  .slice(index * 100, (index + 1) * 100)
                  .map((source) => source.sourceId),
                controller.signal,
              ),
          ),
        )

        const available = new Map(
          statuses
            .flatMap((result) => result.items)
            .map((source) => [source.id, source]),
        )

        const runSources = frozenSources.flatMap((source) => {
          const metadata = available.get(source.sourceId)

          return metadata?.status === 'ready'
            ? [
                {
                  ...source,
                  currentVersionId: metadata.currentVersionId,
                  updatedAt: metadata.updatedAt,
                },
              ]
            : []
        })

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

        const finalParts = await runAgent({
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

              draft = parts
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

          if (ownsView())
            useAssistantStore.getState().upsertConversation(updated)
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

            toast.error(
              '回复保存结果待核对，队列已暂停。继续时会先保存已有进展。',
            )
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
    },
    [],
  )

  const runSend = useCallback(
    (
      text: string,
      references: AiUserReference[] = [],
      boundary?: AiMessage,
      submission?: AssistantSubmission,
    ) => {
      const state = useAssistantStore.getState()
      const ownerId = useUserStore.getState().currentUser?.id

      if (!ownerId) return Promise.resolve('paused' as const)

      return executeAssistantRun(
        {
          ownerId,
          recoveryEpoch: getDraftRecoveryEpoch(ownerId),
          accountGeneration: getAssistantAccountGeneration(),
          conversationId: state.activeConversationId,
          submissionId: submission?.id ?? crypto.randomUUID(),
          targetResumeId: submission
            ? submission.targetResumeId
            : resolveActiveResumeId(),
        },
        (run) => executeSend(text, references, boundary, submission, run),
      )
    },
    [executeSend],
  )

  const drainQueue = useCallback(
    function drainQueue() {
      return runner
        .start(async () => {
          while (true) {
            const state = useAssistantStore.getState()
            const next = state.queuedMessages[0]
            const viewVersion = state.conversationViewVersion
            const ownerId = useUserStore.getState().currentUser?.id

            if (state.queuePaused || state.loadingMessages || !ownerId) break

            const pendingUpdate = state.pendingMessageUpdates[0]

            if (pendingUpdate) {
              const recoveryEpoch = getDraftRecoveryEpoch(ownerId)

              useAssistantStore.setState({ runPhase: 'saving' })

              try {
                await updateMessage(pendingUpdate.id, {
                  parts: pendingUpdate.parts,
                })

                updateConversationDraft(
                  useAssistantStore,
                  ownerId,
                  pendingUpdate.conversationId,
                  (draft) => ({
                    pendingMessageUpdates: draft.pendingMessageUpdates.filter(
                      (message) => message.id !== pendingUpdate.id,
                    ),
                  }),
                  recoveryEpoch,
                )
              } catch (error) {
                toast.error('修改记录仍未保存，队列已暂停', {
                  description: getErrorMessage(error),
                })

                useAssistantStore.setState({ queuePaused: true })
                break
              }

              if (
                useUserStore.getState().currentUser?.id !== ownerId ||
                useAssistantStore.getState().conversationViewVersion !==
                  viewVersion
              )
                break

              useAssistantStore.setState({ queuePaused: false })
              continue
            }

            const pending = state.pendingAssistantWrite
            const recoveryEpoch = getDraftRecoveryEpoch(ownerId)

            if (pending) {
              if (
                pending.userId !== ownerId ||
                pending.conversationId !== state.activeConversationId
              )
                break

              useAssistantStore.setState({ runPhase: 'saving' })

              try {
                const saved = await insertMessage(pending.conversationId, {
                  id: pending.id,
                  role: 'assistant',
                  parts: pending.parts,
                })

                const current = useAssistantStore.getState()

                if (useUserStore.getState().currentUser?.id !== ownerId) break
                if (current.activeConversationId !== pending.conversationId) {
                  updateConversationDraft(
                    useAssistantStore,
                    ownerId,
                    pending.conversationId,
                    () => ({ pendingAssistantWrite: null }),
                    recoveryEpoch,
                  )

                  break
                }

                useAssistantStore.setState({ pendingAssistantWrite: null })

                if (
                  current.messages.some((message) => message.id === pending.id)
                )
                  current.replaceMessage(pending.id, saved)
                else current.appendMessage(saved)
              } catch (error) {
                updateConversationDraft(
                  useAssistantStore,
                  ownerId,
                  pending.conversationId,
                  () => ({ pendingAssistantWrite: pending }),
                  recoveryEpoch,
                )

                toast.error('回复仍未保存，稍后可继续核对', {
                  description: getErrorMessage(error),
                })

                break
              }

              continue
            }

            if (
              !next ||
              next.ownerId !== ownerId ||
              next.conversationId !== state.activeConversationId
            )
              break

            useAssistantStore.setState({
              queuedMessages: state.queuedMessages.slice(1),
            })

            const outcome = await runSend(
              next.text,
              next.references,
              undefined,
              next,
            )

            const current = useAssistantStore.getState()

            const stillOwnsView =
              ownerId === useUserStore.getState().currentUser?.id &&
              current.conversationViewVersion === viewVersion

            if (!stillOwnsView) break
            if (
              outcome === 'paused' ||
              (outcome === 'interrupted' && !continueAfterInterruption)
            ) {
              useAssistantStore.setState({ queuePaused: true })
              continueAfterInterruption = false
              break
            }

            continueAfterInterruption = false
          }

          if (!useAssistantStore.getState().streaming)
            useAssistantStore.setState({ runPhase: 'idle' })
        })
        .catch((error) => {
          useAssistantStore.setState({ queuePaused: true, runPhase: 'idle' })
          toast.error('发送已暂停', { description: getErrorMessage(error) })
        })
        .finally(() => {
          const state = useAssistantStore.getState()
          const next = state.queuedMessages[0]

          if (
            !runner.busy &&
            !state.queuePaused &&
            !state.loadingMessages &&
            next?.ownerId === useUserStore.getState().currentUser?.id &&
            next.conversationId === state.activeConversationId
          )
            queueMicrotask(() => drainQueue())
        })
    },
    [runSend],
  )

  const sendMessage = useCallback(
    (
      text: string,
      selected: AiUserReference[] = [],
      mode: 'queue' | 'interrupt' | 'feedback' = 'feedback',
    ): boolean => {
      const state = useAssistantStore.getState()
      const ownerId = useUserStore.getState().currentUser?.id

      if (
        !ownerId ||
        state.loadingMessages ||
        state.initializing ||
        state.bootstrapError
      )
        return false
      if (state.composerUploadCount) {
        toast.info('请先等文件上传完成，或重试、移除未完成的文件。')

        return false
      }

      try {
        const references = uniqueReferences([
          ...selected,
          ...createSkillReferences(text),
        ])

        const trimmed = text.trim()

        if (!trimmed && !references.length) return false

        const targetResumeId = resolveActiveResumeId()
        const explicitSources = freezeSourceScope([], references)

        const scope = explicitSources.length
          ? explicitSources
          : (state.composerLibrarySources ??
            peekSourceScope({
              ownerId,
              conversationId: state.activeConversationId,
              resumeId: targetResumeId,
              scopeRevision: state.sourceScopeRevision,
            }))

        if (!scope) {
          toast.error('资料范围尚未读取完成，请稍后再发送。')

          return false
        }

        const pending = state.pendingConfirm
        const revising = pending?.status === 'pending' && mode === 'feedback'

        const submission: AssistantSubmission = {
          id: crypto.randomUUID(),
          ownerId,
          conversationId: state.activeConversationId,
          text: trimmed,
          references,
          thinking: state.deepThinking,
          targetResumeId,
          sources: freezeSourceScope(scope, references),
          createdAt: new Date().toISOString(),
          ...(revising ? { proposalId: pending.id } : {}),
        }

        if (revising && !trimmed) return false
        if (revising)
          pending.resolve({
            kind: 'revise',
            feedback: trimmed,
            proposalId: pending.id,
          })

        const interrupt = mode === 'interrupt' || Boolean(revising)

        if (
          runner.busy &&
          state.runPhase === 'settling' &&
          !state.abortController
        )
          continueAfterInterruption = true

        useAssistantStore.setState((current) => ({
          queuedMessages: interrupt
            ? [submission, ...current.queuedMessages]
            : [...current.queuedMessages, submission],
          queuePaused: false,
        }))

        if (interrupt && runner.busy) {
          continueAfterInterruption = true
          state.abortController?.abort()
          useAssistantStore.setState({ runPhase: 'settling' })
        }

        drainQueue()

        return true
      } catch (error) {
        toast.error('无法发送消息', { description: getErrorMessage(error) })

        return false
      }
    },
    [drainQueue],
  )

  const resumeQueue = useCallback(() => {
    useAssistantStore.setState({ queuePaused: false })
    drainQueue()
  }, [drainQueue])

  const sendQueuedNow = useCallback(
    (id: string) => {
      const state = useAssistantStore.getState()
      const item = state.queuedMessages.find((message) => message.id === id)

      if (!item) return

      useAssistantStore.setState({
        queuedMessages: [
          item,
          ...state.queuedMessages.filter((message) => message.id !== id),
        ],
        queuePaused: false,
      })

      if (runner.busy) {
        continueAfterInterruption = true
        state.abortController?.abort()
        useAssistantStore.setState({ runPhase: 'settling' })
      }

      drainQueue()
    },
    [drainQueue],
  )

  const reviseConfirmation = useCallback(() => {
    const state = useAssistantStore.getState()

    const sent = sendMessage(
      state.confirmationFeedback,
      state.composerReferences,
      'feedback',
    )

    if (sent)
      useAssistantStore.setState({
        confirmationFeedback: '',
        composerReferences: [],
        composerSkillIds: [],
        composerLibrarySources: null,
      })

    return sent
  }, [sendMessage])

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
            (outcome === 'interrupted' && !continueAfterInterruption)
          )
            useAssistantStore.setState({ queuePaused: true })

          continueAfterInterruption = false
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

  const stopStreaming = useCallback(() => {
    continueAfterInterruption = false
    cancelActiveAssistantRun()
  }, [])

  return {
    sendMessage,
    resumeQueue,
    sendQueuedNow,
    reviseConfirmation,
    retryLast,
    regenerateFrom,
    editUserMessageAndRerun,
    stopStreaming,
  }
}
