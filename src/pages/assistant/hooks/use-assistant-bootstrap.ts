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
      const existing = useAssistantStore.getState()

      const preserveView =
        existing.bootstrapGeneration === scope.generation &&
        !existing.initializing &&
        (!existing.loadingMessages ||
          (existing.activeConversationId !== null &&
            existing.pendingConversationId === existing.activeConversationId &&
            existing.conversationLoadRequestId === null)) &&
        (!existing.bootstrapError || existing.bootstrapError.preserveView)

      const retryConversationId =
        existing.bootstrapError?.conversationId ?? null

      let restoringConversationId = retryConversationId

      useAssistantStore.setState({
        ...(!preserveView && {
          ...(!retryConversationId && { conversations: [] }),
          messages: [],
          initializing: true,
          loadingMessages: false,
          pendingConversationId: null,
          conversationLoadRequestId: null,
        }),
        bootstrapError: null,
        loadingConversations: !retryConversationId,
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

      const completeBootstrap = () => {
        finishBootstrap()
        useAssistantStore.setState({ bootstrapGeneration: scope.generation })
      }

      try {
        const conversations = retryConversationId
          ? useAssistantStore.getState().conversations
          : await loadAssistantConversations()

        if (!ownsRequest()) return

        useAssistantStore.getState().setConversations(conversations)
        useAssistantStore.getState().setLoadingConversations(false)

        if (!ownsView()) {
          completeBootstrap()

          return
        }

        const currentActiveId =
          useAssistantStore.getState().activeConversationId

        // 用户主动创建的空白会话在返回时仍保持为空白会话。
        if (preserveView && !retryConversationId && !currentActiveId) {
          completeBootstrap()

          return
        }

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
          completeBootstrap()

          useAssistantStore.getState().setConversationView(null, [], {})

          return
        }

        restoringConversationId = restored.id

        const refreshingCurrent =
          preserveView && restored.id === currentActiveId

        if (refreshingCurrent) {
          useAssistantStore.setState({
            loadingMessages: true,
            pendingConversationId: restored.id,
          })
        } else if (preserveView) {
          useAssistantStore.setState({ initializing: true, messages: [] })
        }

        const { messages, hasMore } = await loadAssistantMessages(restored.id)

        if (!ownsRequest()) return

        completeBootstrap()

        if (!ownsView()) return
        if (
          refreshingCurrent &&
          (useAssistantStore.getState().messages !== initialView.messages ||
            useAssistantStore.getState().streaming)
        ) {
          useAssistantStore.setState({
            loadingMessages: false,
            pendingConversationId: null,
          })

          return
        }

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
          useAssistantStore.setState({ bootstrapGeneration: null })
        } else if (
          preserveView &&
          (!restoringConversationId ||
            restoringConversationId === initialView.activeConversationId)
        ) {
          useAssistantStore.setState({
            loadingMessages: false,
            pendingConversationId: null,
            bootstrapError: {
              message: getErrorMessage(error),
              conversationId: restoringConversationId,
              preserveView: true,
            },
          })

          return
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
