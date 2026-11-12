import { useEffect } from 'react'
import {
  loadAssistantConversations,
  loadAssistantMessages,
  useConversationReadScope,
} from './conversation-reads'
import { getErrorMessage } from '@/utils'
import useAssistantStore, { cancelActiveAssistantRun } from '../store'
import {
  chooseRestoredConversation,
  readLastConversationId,
  writeLastConversationId,
} from '../utils'

export function useAssistantBootstrap() {
  const scope = useConversationReadScope()
  const attempt = useAssistantStore((state) => state.bootstrapAttempt)

  useEffect(() => {
    let cancelled = false

    const ownsRequest = () =>
      !cancelled &&
      scope.generation === useConversationReadScope.getState().generation

    const load = async () => {
      const retryConversationId =
        useAssistantStore.getState().bootstrapError?.conversationId ?? null

      let restoringConversationId = retryConversationId

      useAssistantStore.setState({
        ...(!retryConversationId && { conversations: [] }),
        messages: [],
        initializing: true,
        bootstrapError: null,
        loadingConversations: !retryConversationId,
        loadingMessages: false,
        pendingConversationId: null,
        conversationLoadRequestId: null,
      })

      const initialView = useAssistantStore.getState()

      const ownsView = () => {
        const current = useAssistantStore.getState()

        return (
          ownsRequest() &&
          current.conversationViewVersion ===
            initialView.conversationViewVersion &&
          current.conversationLoadRequestId ===
            initialView.conversationLoadRequestId
        )
      }

      const finishBootstrap = () => {
        useAssistantStore.setState({
          initializing: false,
          loadingConversations: false,
        })
      }

      try {
        const conversations = retryConversationId
          ? useAssistantStore.getState().conversations
          : await loadAssistantConversations()

        if (!ownsRequest()) return

        useAssistantStore.getState().setConversations(conversations)
        useAssistantStore.getState().setLoadingConversations(false)

        if (!ownsView()) {
          finishBootstrap()

          return
        }

        const currentActiveId =
          useAssistantStore.getState().activeConversationId

        const restored = retryConversationId
          ? conversations.find(
              (conversation) => conversation.id === retryConversationId,
            )
          : chooseRestoredConversation(
              conversations,
              currentActiveId,
              readLastConversationId(),
            )

        if (!restored) {
          useAssistantStore.setState({
            initializing: false,
            loadingConversations: false,
          })

          useAssistantStore.getState().setConversationView(null, [], {})

          return
        }

        restoringConversationId = restored.id

        const { messages, hasMore } = await loadAssistantMessages(restored.id)

        if (!ownsRequest()) return

        useAssistantStore.setState({
          initializing: false,
          loadingConversations: false,
        })

        if (!ownsView()) return

        useAssistantStore
          .getState()
          .setConversationView(restored.id, messages, { hasMore })

        writeLastConversationId(restored.id)
      } catch (error) {
        if (!ownsRequest()) return

        finishBootstrap()

        if (!ownsView()) return
        if (getErrorMessage(error) === '用户未登录') {
          restoringConversationId = null
          useAssistantStore.getState().setConversations([])
          useAssistantStore.getState().setConversationView(null, [], {})
        }

        useAssistantStore.setState({
          initializing: false,
          loadingConversations: false,
          loadingMessages: false,
          pendingConversationId: null,
          conversationLoadRequestId: null,
          activeConversationId: null,
          bootstrapError: {
            message: getErrorMessage(error),
            conversationId: restoringConversationId,
          },
        })
      }
    }

    load()

    return () => {
      cancelled = true
      cancelActiveAssistantRun()
    }
  }, [scope.generation, attempt])
}
