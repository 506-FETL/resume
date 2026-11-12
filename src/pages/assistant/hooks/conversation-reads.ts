import { create } from 'zustand'
import { listConversations, listMessages } from '@/lib/supabase/ai'
import useUserStore from '@/store/user'
import useAssistantStore, { cancelActiveAssistantRun } from '../store'

export const useConversationReadScope = create(() => ({
  owner: useUserStore.getState().currentUser?.id ?? null,
  generation: 0,
}))

let conversationsPending: ReturnType<typeof listConversations> | undefined
const messagesPending = new Map<string, ReturnType<typeof listMessages>>()

useUserStore.subscribe((state) => {
  const owner = state.currentUser?.id ?? null

  if (owner === useConversationReadScope.getState().owner) return

  conversationsPending = undefined
  messagesPending.clear()
  cancelActiveAssistantRun()
  useAssistantStore.getState().setConversations([])
  useAssistantStore.getState().setConversationView(null, [], {})
  useAssistantStore.setState({ bootstrapGeneration: null, initializing: true })

  useConversationReadScope.setState((scope) => ({
    owner,
    generation: scope.generation + 1,
  }))
})

export function loadAssistantConversations() {
  if (conversationsPending) return conversationsPending

  const request = listConversations().finally(() => {
    if (conversationsPending === request) conversationsPending = undefined
  })

  conversationsPending = request

  return request
}

export function loadAssistantMessages(conversationId: string) {
  const pending = messagesPending.get(conversationId)

  if (pending) return pending

  const request = listMessages(conversationId, { limit: 30 }).finally(() => {
    if (messagesPending.get(conversationId) === request)
      messagesPending.delete(conversationId)
  })

  messagesPending.set(conversationId, request)

  return request
}
