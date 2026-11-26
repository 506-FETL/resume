import { create } from 'zustand'
import {
  getConversation,
  listConversations,
  type ConversationCursor,
  type ConversationPage,
} from '@/lib/supabase/ai/conversations'
import {
  getConversationWithMessages,
  listMessages,
} from '@/lib/supabase/ai/messages'
import {
  conversationDetailReads,
  conversationMessageReads,
  conversationPageReads,
  resetConversationReads,
} from '@/lib/supabase/ai/history-cache'
import useUserStore from '@/store/user'
import useAssistantStore, { cancelActiveAssistantRun } from '../store'
import { mergeConversations } from '../store/history-slice'
import { readLastConversationId } from '../utils/storage'

export const useConversationReadScope = create(() => ({
  owner: useUserStore.getState().currentUser?.id ?? null,
  generation: 0,
}))

let appliedPage: ConversationPage | undefined

let preload:
  | {
      expires: number
      list: ReturnType<typeof listConversations>
      target: string | null
      messages?: ReturnType<typeof listMessages>
    }
  | undefined

useUserStore.subscribe((state) => {
  const owner = state.currentUser?.id ?? null

  if (owner === useConversationReadScope.getState().owner) return

  preload = undefined
  appliedPage = undefined
  resetConversationReads()
  cancelActiveAssistantRun()
  useAssistantStore.getState().setConversations([])
  useAssistantStore.getState().setConversationView(null, [], {})

  useAssistantStore.setState({
    bootstrapGeneration: null,
    initializing: true,
    nextConversationCursor: null,
    loadingMoreConversations: false,
    searchOpen: false,
    conversationListError: false,
  })

  useConversationReadScope.setState((scope) => ({
    owner,
    generation: scope.generation + 1,
  }))
})

export function loadAssistantConversations(owner: string) {
  return conversationPageReads.read(owner, () => listConversations(owner))
}

export function loadAssistantMessages(id: string, restoreOwner?: string) {
  return conversationMessageReads.read(id, async () => {
    const page = restoreOwner
      ? await getConversationWithMessages(restoreOwner, id)
      : await listMessages(id, { limit: 30 })

    if (
      page.messages.some(
        (message) =>
          message.role === 'assistant' &&
          message.parts.some(
            (part) => part.type === 'text' && part.text.trim(),
          ),
      )
    ) {
      import('../components/message-bubble/text-part')
        .then(({ TextPart }) => TextPart.preload())
        .catch(() => undefined)
    }

    return page
  })
}

export function loadConversationSummary(owner: string, id: string) {
  return conversationDetailReads.read(id, () => getConversation(owner, id))
}

export function preloadAssistantHistory() {
  const { owner } = useConversationReadScope.getState()

  if (!owner || (preload && preload.expires > Date.now())) return

  const active = useAssistantStore.getState()

  const target =
    active.bootstrapGeneration === null
      ? readLastConversationId()
      : active.activeConversationId

  const list = loadAssistantConversations(owner)
  const messages = target ? loadAssistantMessages(target, owner) : undefined

  list.catch(() => undefined)
  messages?.catch(() => undefined)
  preload = { list, messages, target, expires: Date.now() + 30_000 }
}

export function consumeAssistantPreload() {
  const prepared = preload

  preload = undefined

  return prepared && prepared.expires > Date.now() ? prepared : undefined
}

export async function loadMoreConversations(cursor: ConversationCursor) {
  const scope = useConversationReadScope.getState()
  const state = useAssistantStore.getState()

  if (!scope.owner || state.loadingMoreConversations) return

  useAssistantStore.setState({ loadingMoreConversations: true })

  try {
    const page = await listConversations(scope.owner, cursor)

    if (scope !== useConversationReadScope.getState()) return

    useAssistantStore.setState((current) => {
      if (current.nextConversationCursor !== cursor) return {}

      return {
        conversations: mergeConversations(
          page.conversations,
          current.conversations,
        ),
        nextConversationCursor: page.next,
      }
    })
  } finally {
    if (scope === useConversationReadScope.getState())
      useAssistantStore.setState({ loadingMoreConversations: false })
  }
}

export function applyAssistantConversationPage(
  page: ConversationPage,
  preserve: boolean,
) {
  if (appliedPage !== page || !preserve) {
    const state = useAssistantStore.getState()

    const active = state.conversations.find(
      (item) => item.id === state.activeConversationId,
    )

    const conversations =
      active && !page.conversations.some((item) => item.id === active.id)
        ? mergeConversations(page.conversations, [active])
        : page.conversations

    useAssistantStore.setState({
      conversations,
      nextConversationCursor: page.next,
    })

    appliedPage = page
  }

  useAssistantStore.setState({
    loadingConversations: false,
    conversationListError: false,
  })
}

export async function retryAssistantConversationList() {
  const scope = useConversationReadScope.getState()
  const state = useAssistantStore.getState()

  if (!scope.owner || state.loadingConversations) return
  if (
    state.bootstrapGeneration === null &&
    state.bootstrapError &&
    !state.bootstrapError.conversationId
  ) {
    useAssistantStore.setState({ bootstrapAttempt: state.bootstrapAttempt + 1 })

    return
  }

  useAssistantStore.setState({ loadingConversations: true })

  try {
    const page = await loadAssistantConversations(scope.owner)

    if (scope === useConversationReadScope.getState())
      applyAssistantConversationPage(page, true)
  } catch {
    if (scope === useConversationReadScope.getState())
      useAssistantStore.setState({
        loadingConversations: false,
        conversationListError: true,
      })
  }
}
