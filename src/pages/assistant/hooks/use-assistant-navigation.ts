import type { AssistantRouteState, OpenConversationOptions } from '../types'
import { useCallback, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { forgetAssistantReturnPath, resolveAssistantReturnPath } from '@/lib/ai/navigation'
import { deleteConversation, listMessages } from '@/lib/supabase/ai'
import { getErrorMessage } from '@/utils'
import useAssistantStore, { cancelActiveAssistantRun } from '../store'
import { clearLastConversationId, writeLastConversationId } from '../utils'

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement))
    return false
  return target.matches('input, textarea, [contenteditable="true"]')
}

function isPageReload(): boolean {
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  return navigation?.type === 'reload'
}

export function useAssistantNavigation(bindShortcuts = false) {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!bindShortcuts)
      return

    const routeState = location.state as AssistantRouteState | null
    if (!routeState?.from && !isPageReload())
      forgetAssistantReturnPath()
  }, [bindShortcuts, location.state])

  const closeOverlays = useCallback(() => {
    useAssistantStore.setState({
      mobileSidebarOpen: false,
      searchOpen: false,
    })
  }, [])

  const openConversation = useCallback(async (
    id: string,
    options: OpenConversationOptions = {},
  ): Promise<boolean> => {
    const state = useAssistantStore.getState()
    const hasPositionTarget = Object.prototype.hasOwnProperty.call(options, 'targetMessageId')
    if (state.activeConversationId === id && !hasPositionTarget) {
      if (options.closeOverlays !== false)
        closeOverlays()
      return true
    }

    cancelActiveAssistantRun()
    const requestId = crypto.randomUUID()
    useAssistantStore.setState({
      streaming: false,
      streamingText: '',
      streamingParts: [],
      abortController: null,
      pendingConversationId: id,
      conversationLoadRequestId: requestId,
      loadingMessages: true,
    })

    try {
      const messages = await listMessages(id)
      if (useAssistantStore.getState().conversationLoadRequestId !== requestId)
        return false

      useAssistantStore.getState().setConversationView(
        id,
        messages,
        options.targetMessageId ?? null,
      )
      writeLastConversationId(id)
      if (options.closeOverlays !== false)
        closeOverlays()
      return true
    }
    catch (error) {
      if (useAssistantStore.getState().conversationLoadRequestId === requestId) {
        useAssistantStore.setState({
          pendingConversationId: null,
          conversationLoadRequestId: null,
          loadingMessages: false,
        })
        toast.error('加载消息失败', { description: getErrorMessage(error) })
      }
      return false
    }
  }, [closeOverlays])

  const startNewConversation = useCallback(() => {
    cancelActiveAssistantRun()
    clearLastConversationId()
    useAssistantStore.setState({
      activeConversationId: null,
      messages: [],
      streaming: false,
      streamingText: '',
      streamingParts: [],
      abortController: null,
      loadingMessages: false,
      pendingConversationId: null,
      conversationLoadRequestId: null,
      targetMessageId: null,
      mobileSidebarOpen: false,
      searchOpen: false,
    })
  }, [])

  const deleteAndSelectConversation = useCallback(async (id: string) => {
    const { conversations, activeConversationId } = useAssistantStore.getState()
    const deletedIndex = conversations.findIndex(conversation => conversation.id === id)
    const candidate = conversations[deletedIndex + 1]
      ?? conversations[deletedIndex - 1]
      ?? null

    try {
      if (activeConversationId === id)
        cancelActiveAssistantRun()
      await deleteConversation(id)
      useAssistantStore.getState().removeConversationLocal(id)
      toast.success('已删除会话')

      if (activeConversationId !== id)
        return

      clearLastConversationId(id)
      if (candidate)
        await openConversation(candidate.id)
      else
        useAssistantStore.getState().setConversationView(null, [])
    }
    catch (error) {
      toast.error('删除失败', { description: getErrorMessage(error) })
    }
  }, [openConversation])

  const returnToWorkspace = useCallback(() => {
    cancelActiveAssistantRun()
    closeOverlays()
    const routeState = location.state as AssistantRouteState | null
    navigate(resolveAssistantReturnPath(routeState?.from, isPageReload()))
  }, [closeOverlays, location.state, navigate])

  const toggleSidebar = useCallback(() => {
    const state = useAssistantStore.getState()
    state.setSidebarExpanded(!state.sidebarExpanded)
  }, [])

  useEffect(() => {
    if (!bindShortcuts)
      return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || event.defaultPrevented)
        return

      const modifier = event.metaKey || event.ctrlKey
      if (modifier && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        useAssistantStore.getState().setSearchOpen(true)
        return
      }

      if (
        modifier
        && event.shiftKey
        && event.key.toLowerCase() === 'o'
        && !isEditableTarget(event.target)
      ) {
        event.preventDefault()
        startNewConversation()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [bindShortcuts, startNewConversation])

  return {
    openConversation,
    startNewConversation,
    deleteAndSelectConversation,
    returnToWorkspace,
    toggleSidebar,
  }
}
