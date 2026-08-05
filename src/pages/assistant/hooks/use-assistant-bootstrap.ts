import { useEffect } from 'react'
import { toast } from 'sonner'
import { listConversations, listMessages } from '@/lib/supabase/ai'
import { getErrorMessage } from '@/utils'
import useAssistantStore, { cancelActiveAssistantRun } from '../store'
import {
  chooseRestoredConversation,
  readLastConversationId,
  writeLastConversationId,
} from '../utils'

export function useAssistantBootstrap() {
  useEffect(() => {
    let cancelled = false

    const load = async () => {
      useAssistantStore.setState({
        initializing: true,
        loadingConversations: true,
        loadingMessages: false,
        pendingConversationId: null,
        conversationLoadRequestId: null,
      })

      try {
        const conversations = await listConversations()
        if (cancelled)
          return

        useAssistantStore.getState().setConversations(conversations)
        const currentActiveId = useAssistantStore.getState().activeConversationId
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
          useAssistantStore.getState().setConversationView(null, [])
          return
        }

        const messages = await listMessages(restored.id)
        if (cancelled)
          return

        useAssistantStore.setState({
          initializing: false,
          loadingConversations: false,
        })
        useAssistantStore.getState().setConversationView(restored.id, messages)
        writeLastConversationId(restored.id)
      }
      catch (error) {
        if (cancelled)
          return
        if (getErrorMessage(error) === '用户未登录') {
          useAssistantStore.getState().setConversations([])
          useAssistantStore.getState().setConversationView(null, [])
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
  }, [])
}
