import type { ConfirmPreview } from '@/lib/ai/agent/confirm-bridge'
import type { AiConversation, AiMessage, AiMessagePart } from '@/lib/ai/types'
import { create } from 'zustand'
import { ASSISTANT_SIDEBAR_STORAGE_KEY } from './const'
import { readStoredBoolean, writeStoredBoolean } from './utils'

interface AssistantStore {
  conversations: AiConversation[]
  activeConversationId: string | null
  messages: AiMessage[]
  initializing: boolean
  streaming: boolean
  streamingText: string
  streamingParts: AiMessagePart[]
  composerDraft: string
  pendingConfirm: { id: string, toolName: string, preview: ConfirmPreview, resolve: (confirmed: boolean) => void } | null
  loadingConversations: boolean
  loadingMessages: boolean
  sidebarExpanded: boolean
  mobileSidebarOpen: boolean
  searchOpen: boolean
  pendingConversationId: string | null
  conversationLoadRequestId: string | null
  conversationViewVersion: number
  targetMessageId: string | null
  abortController: AbortController | null

  setConversations: (list: AiConversation[]) => void
  upsertConversation: (conv: AiConversation) => void
  removeConversationLocal: (id: string) => void
  setActiveConversationId: (id: string | null) => void
  setConversationView: (conversationId: string | null, messages: AiMessage[], targetMessageId?: string | null) => void
  setMessages: (list: AiMessage[]) => void
  appendMessage: (msg: AiMessage) => void
  replaceMessage: (id: string, msg: AiMessage) => void
  removeMessage: (id: string) => void
  setStreaming: (value: boolean) => void
  setStreamingText: (text: string) => void
  setStreamingParts: (parts: AiMessagePart[]) => void
  setComposerDraft: (text: string) => void
  setPendingConfirm: (p: AssistantStore['pendingConfirm']) => void
  setInitializing: (value: boolean) => void
  setLoadingConversations: (value: boolean) => void
  setLoadingMessages: (value: boolean) => void
  setSidebarExpanded: (expanded: boolean) => void
  setMobileSidebarOpen: (open: boolean) => void
  setSearchOpen: (open: boolean) => void
  setTargetMessageId: (id: string | null) => void
  setAbortController: (controller: AbortController | null) => void
  reset: () => void
}

const useAssistantStore = create<AssistantStore>()(set => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
  initializing: true,
  streaming: false,
  streamingText: '',
  streamingParts: [],
  composerDraft: '',
  pendingConfirm: null,
  loadingConversations: false,
  loadingMessages: false,
  sidebarExpanded: readStoredBoolean(ASSISTANT_SIDEBAR_STORAGE_KEY, true),
  mobileSidebarOpen: false,
  searchOpen: false,
  pendingConversationId: null,
  conversationLoadRequestId: null,
  conversationViewVersion: 0,
  targetMessageId: null,
  abortController: null,

  setConversations: list => set({ conversations: list }),
  upsertConversation: conv => set((state) => {
    const exists = state.conversations.some(c => c.id === conv.id)
    const conversations = exists
      ? state.conversations.map(c => (c.id === conv.id ? conv : c))
      : [conv, ...state.conversations]
    // 按 updatedAt desc 维持列表顺序
    conversations.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    return { conversations }
  }),
  removeConversationLocal: id => set(state => ({
    conversations: state.conversations.filter(c => c.id !== id),
    activeConversationId: state.activeConversationId === id ? null : state.activeConversationId,
    messages: state.activeConversationId === id ? [] : state.messages,
  })),
  setActiveConversationId: id => set({ activeConversationId: id }),
  setConversationView: (conversationId, messages, targetMessageId = null) => set(state => ({
    activeConversationId: conversationId,
    messages,
    targetMessageId,
    pendingConversationId: null,
    conversationLoadRequestId: null,
    loadingMessages: false,
    conversationViewVersion: state.conversationViewVersion + 1,
  })),
  setMessages: list => set({ messages: list }),
  appendMessage: msg => set(state => ({ messages: [...state.messages, msg] })),
  replaceMessage: (id, msg) => set(state => ({ messages: state.messages.map(m => (m.id === id ? msg : m)) })),
  removeMessage: id => set(state => ({ messages: state.messages.filter(m => m.id !== id) })),
  setStreaming: value => set({ streaming: value }),
  setStreamingText: text => set({ streamingText: text }),
  setStreamingParts: parts => set({ streamingParts: parts }),
  setComposerDraft: text => set({ composerDraft: text }),
  setPendingConfirm: p => set({ pendingConfirm: p }),
  setInitializing: value => set({ initializing: value }),
  setLoadingConversations: value => set({ loadingConversations: value }),
  setLoadingMessages: value => set({ loadingMessages: value }),
  setSidebarExpanded: (expanded) => {
    writeStoredBoolean(ASSISTANT_SIDEBAR_STORAGE_KEY, expanded)
    set({ sidebarExpanded: expanded })
  },
  setMobileSidebarOpen: open => set({ mobileSidebarOpen: open }),
  setSearchOpen: open => set({ searchOpen: open }),
  setTargetMessageId: id => set({ targetMessageId: id }),
  setAbortController: controller => set({ abortController: controller }),
  reset: () => set({
    activeConversationId: null,
    messages: [],
    streaming: false,
    streamingText: '',
    streamingParts: [],
    pendingConversationId: null,
    conversationLoadRequestId: null,
    targetMessageId: null,
  }),
}))

export function cancelActiveAssistantRun(): void {
  const state = useAssistantStore.getState()
  state.pendingConfirm?.resolve(false)
  state.abortController?.abort()
  useAssistantStore.setState({
    streaming: false,
    streamingText: '',
    streamingParts: [],
    abortController: null,
  })
}

export default useAssistantStore
