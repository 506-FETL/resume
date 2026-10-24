import type { AssistantRouteState, OpenConversationOptions } from '../types'
import { useCallback, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useSidebar } from '@/components/ui/sidebar'
import {
  forgetAssistantReturnPath,
  resolveAssistantReturnPath,
} from '@/lib/ai/navigation'
import { deleteConversation, listMessages } from '@/lib/supabase/ai'
import { getErrorMessage } from '@/utils'
import useAssistantStore, { cancelActiveAssistantRun } from '../store'
import { clearLastConversationId, writeLastConversationId } from '../utils'

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

      const hasPositionTarget = Object.prototype.hasOwnProperty.call(
        options,
        'targetMessageId',
      )

      if (state.activeConversationId === id && !hasPositionTarget) {
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
        streamingText: '',
        streamingParts: [],
        composerSkillIds: [],
        abortController: null,
        pendingConversationId: id,
        conversationLoadRequestId: requestId,
        loadingMessages: true,
      })

      try {
        const { messages, hasMore } = await listMessages(id, { limit: 30 })

        if (
          useAssistantStore.getState().conversationLoadRequestId !== requestId
        )
          return false

        useAssistantStore.getState().setConversationView(id, messages, {
          targetMessageId: options.targetMessageId,
          hasMore,
        })

        writeLastConversationId(id)

        if (options.closeOverlays !== false) closeOverlays()

        return true
      } catch (error) {
        if (
          useAssistantStore.getState().conversationLoadRequestId === requestId
        ) {
          useAssistantStore.setState({
            pendingConversationId: null,
            conversationLoadRequestId: null,
            loadingMessages: false,
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
        useAssistantStore.getState().removeConversationLocal(id)
        toast.success('已删除会话')

        if (activeConversationId !== id) return

        clearLastConversationId(id)

        if (candidate) await openConversation(candidate.id)
        else useAssistantStore.getState().setConversationView(null, [], {})
      } catch (error) {
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

    if (
      s.loadingOlder ||
      !s.hasMoreMessages ||
      !s.activeConversationId ||
      !s.oldestMessageCursor ||
      s.inFlightConversationIds[s.activeConversationId]
    )
      return

    useAssistantStore.getState().setLoadingOlder(true)

    const convId = s.activeConversationId

    const ownsView = () => {
      const current = useAssistantStore.getState()

      return (
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
