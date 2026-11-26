import type { AssistantRouteState, OpenConversationOptions } from '../types'
import { useCallback, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useSidebar } from '@/components/ui/sidebar'
import {
  forgetAssistantReturnPath,
  resolveAssistantReturnPath,
} from '@/lib/ai/navigation'
import { deleteConversation } from '@/lib/supabase/ai/conversations'
import { getHistoricalMessage, listMessages } from '@/lib/supabase/ai/messages'
import { CONVERSATION_BOTTOM_TARGET } from '../const'
import {
  loadAssistantMessages,
  loadConversationSummary,
  useConversationReadScope,
} from './conversation-reads'
import { getErrorMessage } from '@/utils'
import { useExperienceSourcesStore } from '@/store/experience-sources'
import useAssistantStore, { cancelActiveAssistantRun } from '../store'
import {
  clearLastConversationId,
  writeLastConversationId,
} from '../utils/storage'

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false

  return target.matches('input, textarea, [contenteditable="true"]')
}

function isPageReload(): boolean {
  const navigation = performance.getEntriesByType('navigation')[0] as
    | PerformanceNavigationTiming
    | undefined

  return navigation?.type === 'reload'
}

export function useAssistantNavigation(bindShortcuts = false) {
  const navigate = useNavigate()
  const location = useLocation()
  const { setOpenMobile } = useSidebar()

  useEffect(() => {
    if (!bindShortcuts) return

    const routeState = location.state as AssistantRouteState | null

    if (!routeState?.from && !isPageReload()) forgetAssistantReturnPath()
  }, [bindShortcuts, location.state])

  const closeOverlays = useCallback(() => {
    setOpenMobile(false)

    useAssistantStore.setState({
      searchOpen: false,
    })
  }, [setOpenMobile])

  const openSearch = useCallback(() => {
    setOpenMobile(false)
    useAssistantStore.getState().setSearchOpen(true)
  }, [setOpenMobile])

  const openConversation = useCallback(
    async (
      id: string,
      options: OpenConversationOptions = {},
    ): Promise<boolean> => {
      const state = useAssistantStore.getState()
      const scope = useConversationReadScope.getState()

      const hasPositionTarget = Object.prototype.hasOwnProperty.call(
        options,
        'targetMessageId',
      )

      if (!scope.owner) return false
      if (state.activeConversationId === id && !hasPositionTarget) {
        if (state.pendingConversationId && state.pendingConversationId !== id)
          useAssistantStore.setState({
            pendingConversationId: null,
            conversationLoadRequestId: null,
            loadingMessages: false,
          })
        if (options.closeOverlays !== false) closeOverlays()

        return true
      }
      if (state.inFlightConversationIds[id]) {
        toast.info('正在保存该会话的进展，请稍后打开')

        return false
      }

      cancelActiveAssistantRun()

      const requestId = crypto.randomUUID()

      useAssistantStore.setState({
        streaming: false,
        initializing: false,
        bootstrapError: null,
        streamingText: '',
        streamingParts: [],
        composerSkillIds: [],
        abortController: null,
        pendingConversationId: id,
        conversationLoadRequestId: requestId,
        loadingOlder: false,
        olderMessagesError: false,
        conversationViewVersion: state.conversationViewVersion + 1,
        loadingMessages: true,
      })

      try {
        const known = state.conversations.find((item) => item.id === id)
        const sameConversation = state.activeConversationId === id

        const ownView = () =>
          scope === useConversationReadScope.getState() &&
          useAssistantStore.getState().conversationLoadRequestId === requestId

        const [conversation, page] = await Promise.all([
          known ?? loadConversationSummary(scope.owner, id),
          sameConversation
            ? { messages: state.messages, hasMore: state.hasMoreMessages }
            : loadAssistantMessages(id),
        ])

        if (!ownView()) return false
        if (!conversation) throw new Error('该对话已被删除')
        if (!known) {
          useAssistantStore.getState().upsertConversation(conversation)
        }

        const target = options.targetMessageId
        let historicalMatch = null

        if (
          target &&
          target !== CONVERSATION_BOTTOM_TARGET &&
          !page.messages.some((message) => message.id === target)
        ) {
          historicalMatch = await getHistoricalMessage(scope.owner, id, target)

          if (!ownView()) return false
          if (!historicalMatch)
            throw new Error('这条历史消息已被删除，请重新搜索')
        }

        if (sameConversation) {
          useAssistantStore.setState({
            historicalMatch,
            targetMessageId: target ?? null,
            pendingConversationId: null,
            conversationLoadRequestId: null,
            loadingMessages: false,
          })
        } else {
          useAssistantStore.getState().setConversationView(id, page.messages, {
            targetMessageId: target,
            hasMore: page.hasMore,
            historicalMatch,
          })
        }

        writeLastConversationId(id)

        if (options.closeOverlays !== false) closeOverlays()

        return true
      } catch (error) {
        if (
          scope === useConversationReadScope.getState() &&
          useAssistantStore.getState().conversationLoadRequestId === requestId
        ) {
          useAssistantStore.setState({
            pendingConversationId: null,
            conversationLoadRequestId: null,
            loadingMessages: false,
            ...(state.initializing &&
              !state.activeConversationId && {
                bootstrapError: {
                  message: getErrorMessage(error),
                  conversationId: id,
                },
              }),
          })

          toast.error('加载消息失败', { description: getErrorMessage(error) })
        }

        return false
      }
    },
    [closeOverlays],
  )

  const startNewConversation = useCallback(() => {
    if (useAssistantStore.getState().initializing) return

    cancelActiveAssistantRun()
    clearLastConversationId()
    // 新会话也是一次视图切换，统一重置分页状态并使旧分页请求失效。
    useAssistantStore.getState().setConversationView(null, [], {})

    useAssistantStore.setState({
      streaming: false,
      streamingText: '',
      streamingParts: [],
      abortController: null,
      searchOpen: false,
    })

    closeOverlays()
  }, [closeOverlays])

  const deleteAndSelectConversation = useCallback(
    async (id: string) => {
      const scope = useConversationReadScope.getState()

      const { conversations, activeConversationId } =
        useAssistantStore.getState()

      const deletedIndex = conversations.findIndex(
        (conversation) => conversation.id === id,
      )

      const candidate =
        conversations[deletedIndex + 1] ??
        conversations[deletedIndex - 1] ??
        null

      try {
        if (activeConversationId === id) cancelActiveAssistantRun()

        await deleteConversation(id)

        if (scope !== useConversationReadScope.getState()) return

        const stillSelected =
          useAssistantStore.getState().activeConversationId === id

        useExperienceSourcesStore.getState().invalidate()
        useAssistantStore.getState().removeConversationLocal(id)
        toast.success('已删除会话')

        if (!stillSelected) return

        clearLastConversationId(id)

        if (candidate) await openConversation(candidate.id)
        else useAssistantStore.getState().setConversationView(null, [], {})
      } catch (error) {
        if (scope !== useConversationReadScope.getState()) return

        toast.error('删除失败', { description: getErrorMessage(error) })
      }
    },
    [openConversation],
  )

  const returnToWorkspace = useCallback(() => {
    cancelActiveAssistantRun()
    closeOverlays()

    const routeState = location.state as AssistantRouteState | null

    navigate(resolveAssistantReturnPath(routeState?.from, isPageReload()))
  }, [closeOverlays, location.state, navigate])

  const loadOlderMessages = useCallback(async () => {
    const s = useAssistantStore.getState()
    const scope = useConversationReadScope.getState()

    if (
      s.loadingOlder ||
      !s.hasMoreMessages ||
      !s.activeConversationId ||
      !s.oldestMessageCursor ||
      s.inFlightConversationIds[s.activeConversationId]
    )
      return

    useAssistantStore.setState({
      loadingOlder: true,
      olderMessagesError: false,
    })

    const convId = s.activeConversationId

    const ownsView = () => {
      const current = useAssistantStore.getState()

      return (
        scope === useConversationReadScope.getState() &&
        current.activeConversationId === convId &&
        current.conversationViewVersion === s.conversationViewVersion
      )
    }

    try {
      const { messages, hasMore } = await listMessages(convId, {
        limit: 30,
        before: s.oldestMessageCursor,
      })

      if (!ownsView()) return

      useAssistantStore.getState().prependOlderMessages(messages, hasMore)
    } catch {
      if (ownsView()) useAssistantStore.setState({ olderMessagesError: true })
    } finally {
      if (ownsView()) useAssistantStore.getState().setLoadingOlder(false)
    }
  }, [])

  useEffect(() => {
    if (!bindShortcuts) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || event.defaultPrevented) return

      const modifier = event.metaKey || event.ctrlKey

      if (modifier && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        openSearch()

        return
      }

      if (
        modifier &&
        event.shiftKey &&
        event.key.toLowerCase() === 'o' &&
        !isEditableTarget(event.target)
      ) {
        event.preventDefault()
        startNewConversation()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [bindShortcuts, openSearch, startNewConversation])

  return {
    openConversation,
    openSearch,
    startNewConversation,
    deleteAndSelectConversation,
    returnToWorkspace,
    loadOlderMessages,
  }
}
