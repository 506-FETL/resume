import type { AiConversation, AiMessage, AiMessagePart } from '@/lib/ai/types'
import { create } from 'zustand'

interface AssistantStore {
  conversations: AiConversation[]
  activeConversationId: string | null
  messages: AiMessage[]
  streaming: boolean
  streamingText: string
  streamingParts: AiMessagePart[]
  composerDraft: string
  loadingConversations: boolean
  loadingMessages: boolean
  abortController: AbortController | null

  setConversations: (list: AiConversation[]) => void
  upsertConversation: (conv: AiConversation) => void
  removeConversationLocal: (id: string) => void
  setActiveConversationId: (id: string | null) => void
  setMessages: (list: AiMessage[]) => void
  appendMessage: (msg: AiMessage) => void
  replaceMessage: (id: string, msg: AiMessage) => void
  removeMessage: (id: string) => void
  setStreaming: (value: boolean) => void
  setStreamingText: (text: string) => void
  setStreamingParts: (parts: AiMessagePart[]) => void
  setComposerDraft: (text: string) => void
  setLoadingConversations: (value: boolean) => void
  setLoadingMessages: (value: boolean) => void
  setAbortController: (controller: AbortController | null) => void
  reset: () => void
}

const useAssistantStore = create<AssistantStore>()(set => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
  streaming: false,
  streamingText: '',
  streamingParts: [],
  composerDraft: '',
  loadingConversations: false,
  loadingMessages: false,
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
  setMessages: list => set({ messages: list }),
  appendMessage: msg => set(state => ({ messages: [...state.messages, msg] })),
  replaceMessage: (id, msg) => set(state => ({ messages: state.messages.map(m => (m.id === id ? msg : m)) })),
  removeMessage: id => set(state => ({ messages: state.messages.filter(m => m.id !== id) })),
  setStreaming: value => set({ streaming: value }),
  setStreamingText: text => set({ streamingText: text }),
  setStreamingParts: parts => set({ streamingParts: parts }),
  setComposerDraft: text => set({ composerDraft: text }),
  setLoadingConversations: value => set({ loadingConversations: value }),
  setLoadingMessages: value => set({ loadingMessages: value }),
  setAbortController: controller => set({ abortController: controller }),
  reset: () => set({ activeConversationId: null, messages: [], streaming: false, streamingText: '', streamingParts: [] }),
}))

export default useAssistantStore
