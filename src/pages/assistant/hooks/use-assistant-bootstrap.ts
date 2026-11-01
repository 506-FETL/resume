import { useEffect } from 'react'
import { toast } from 'sonner'
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

  useEffect(() => {
    let cancelled = false

    const ownsRequest = () =>
      !cancelled &&
      scope.generation === useConversationReadScope.getState().generation

    const load = async () => {
      useAssistantStore.setState({
        conversations: [],
        messages: [],
        initializing: true,
        loadingConversations: true,
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
        const conversations = await loadAssistantConversations()

        if (!ownsRequest()) return

        useAssistantStore.getState().setConversations(conversations)

        if (!ownsView()) {
          finishBootstrap()

          return
        }

        const currentActiveId =
          useAssistantStore.getState().activeConversationId

        const restored = chooseRestoredConversation(
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
          useAssistantStore.getState().setConversations([])
          useAssistantStore.getState().setConversationView(null, [], {})
        }

        useAssistantStore.setState({
          initializing: false,
          loadingConversations: false,
          loadingMessages: false,
          pendingConversationId: null,
          conversationLoadRequestId: null,
        })

        toast.error('加载会话失败', { description: getErrorMessage(error) })
      }
    }

    load()

    return () => {
      cancelled = true
      cancelActiveAssistantRun()
    }
  }, [scope.generation])
}
