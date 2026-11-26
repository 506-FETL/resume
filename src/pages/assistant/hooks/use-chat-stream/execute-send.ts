import { makeLocalMessage } from './messages'
import { prepareSendHistory } from './prepare-history'
import { streamAssistantResponse } from './stream-response'
import type { AiMessage, AiMessagePart, AiUserReference } from '@/lib/ai/types'
import { toast } from 'sonner'
import { createUserParts } from '@/lib/ai/references'
import type { AssistantSubmission } from '../../store/composer-slice'
import { freezeSourceScope } from '../../store/source-scope'
import { type AssistantRun } from '../../runtime/assistant-run'
import {
  getDraftRecoveryEpoch,
  getAssistantAccountGeneration,
  updateConversationDraft,
} from '../../store/composer-sessions'
import {
  createConversation,
  deleteConversation,
  insertMessage,
} from '@/lib/supabase/ai'
import useUserStore from '@/store/user'
import { getErrorMessage } from '@/utils'
import { DEFAULT_CONVERSATION_TITLE } from '../../const'
import useAssistantStore from '../../store'
import { writeLastConversationId } from '../../utils'
import { TextPart } from '../../components/message-bubble/text-part'

export async function executeSend(
  trimmed: string,
  references: AiUserReference[],
  truncateFrom: AiMessage | undefined,
  submission: AssistantSubmission | undefined,
  execution: AssistantRun,
): Promise<'complete' | 'interrupted' | 'paused'> {
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

  // 正文分包与会话准备并行，失败仍由回复区的重试入口处理。
  TextPart.preload().catch(() => undefined)
  import('@/lib/ai/agent').catch(() => undefined)

  // 1. 同步占用运行锁；重跑保留原消息，普通发送立即上屏。
  let frozenSources = freezeSourceScope(submission?.sources ?? [], references)

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
      useAssistantStore.getState().finishConversationRun(lockedConversationId)

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
    messages: truncateFrom ? state.messages : [...state.messages, localUser],
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
    const prepared = await prepareSendHistory(
      truncateFrom,
      initialState,
      execution,
      { ownsView, ownsCurrentRun, finishConversationRun, recoveryEpoch },
      { trimmed, references, frozenSources, userParts, localUser },
    )

    if (!prepared) return 'paused'

    trimmed = prepared.trimmed
    references = prepared.references
    frozenSources = prepared.frozenSources
    userParts = prepared.userParts
  }

  // 2. 后台确保会话存在
  let conversationId = initialConversationId

  let isNewConversation = Boolean(
    initialConversationId &&
    !initialState.hasMoreMessages &&
    !initialState.messages.some((message) => message.role === 'user') &&
    initialState.conversations.find(
      (conversation) => conversation.id === initialConversationId,
    )?.title === DEFAULT_CONVERSATION_TITLE,
  )

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

  return streamAssistantResponse(
    execution,
    { trimmed, references, frozenSources, userParts, localUser },
    {
      conversationId,
      isNewConversation,
      assistantMessageId,
      thinking:
        submission?.thinking ?? useAssistantStore.getState().deepThinking,
    },
    { ownsView, ownsCurrentRun, finishConversationRun, recoveryEpoch },
  )
}
