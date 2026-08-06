import type { CanvasTabKey } from './types'
import type { ConfirmPreview } from '@/lib/ai/agent/confirm-bridge'
import type { AiConversation, AiMessage, AiMessagePart } from '@/lib/ai/types'
import { create } from 'zustand'
import { ASSISTANT_CANVAS_STORAGE_KEY, ASSISTANT_CANVAS_TAB_PINNED_STORAGE_KEY, ASSISTANT_CANVAS_TAB_STORAGE_KEY, ASSISTANT_CANVAS_WIDTH_STORAGE_KEY, ASSISTANT_DEEP_THINKING_STORAGE_KEY, ASSISTANT_SIDEBAR_STORAGE_KEY, CANVAS_DEFAULT_WIDTH, CANVAS_MAX_WIDTH, CANVAS_MIN_WIDTH, CANVAS_TABS } from './const'
import { readStoredBoolean, writeStoredBoolean } from './utils'

// 本轮 token 用量（输入/输出/合计），用于会话层轻量展示成本
export interface TokenUsage {
  input: number
  output: number
  total: number
}

function readStoredCanvasWidth(): number {
  try {
    const raw = Number(localStorage.getItem(ASSISTANT_CANVAS_WIDTH_STORAGE_KEY))
    if (Number.isFinite(raw) && raw > 0)
      return Math.min(CANVAS_MAX_WIDTH, Math.max(CANVAS_MIN_WIDTH, raw))
  }
  catch {}
  return CANVAS_DEFAULT_WIDTH
}

function readStoredCanvasTab(): CanvasTabKey {
  try {
    const raw = localStorage.getItem(ASSISTANT_CANVAS_TAB_STORAGE_KEY)
    if (raw && (CANVAS_TABS as readonly string[]).includes(raw))
      return raw as CanvasTabKey
  }
  catch {}
  return 'resume'
}

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
  deepThinking: boolean
  canvasOpen: boolean
  canvasWidth: number
  canvasMobileOpen: boolean
  canvasActiveTab: CanvasTabKey
  canvasTabPinned: boolean
  usageByMessageId: Record<string, TokenUsage>
  streamingUsage: TokenUsage | null
  canvasRefreshTick: number
  previewResumeId: string | null
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
  setDeepThinking: (v: boolean) => void
  setCanvasOpen: (v: boolean) => void
  setCanvasWidth: (px: number) => void
  setCanvasMobileOpen: (v: boolean) => void
  setCanvasActiveTab: (tab: CanvasTabKey) => void
  requestCanvasTab: (tab: CanvasTabKey) => void
  setCanvasTabPinned: (v: boolean) => void
  setUsageForMessage: (id: string, usage: TokenUsage) => void
  setStreamingUsage: (usage: TokenUsage | null) => void
  bumpCanvasRefresh: () => void
  setPreviewResumeId: (id: string | null) => void
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
  deepThinking: readStoredBoolean(ASSISTANT_DEEP_THINKING_STORAGE_KEY, false),
  canvasOpen: readStoredBoolean(ASSISTANT_CANVAS_STORAGE_KEY, true),
  canvasWidth: readStoredCanvasWidth(),
  canvasMobileOpen: false,
  canvasActiveTab: readStoredCanvasTab(),
  canvasTabPinned: readStoredBoolean(ASSISTANT_CANVAS_TAB_PINNED_STORAGE_KEY, false),
  usageByMessageId: {},
  streamingUsage: null,
  canvasRefreshTick: 0,
  previewResumeId: null,
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
  setDeepThinking: (v) => {
    writeStoredBoolean(ASSISTANT_DEEP_THINKING_STORAGE_KEY, v)
    set({ deepThinking: v })
  },
  setCanvasOpen: (v) => {
    writeStoredBoolean(ASSISTANT_CANVAS_STORAGE_KEY, v)
    set({ canvasOpen: v })
  },
  setCanvasWidth: (px) => {
    const clamped = Math.min(CANVAS_MAX_WIDTH, Math.max(CANVAS_MIN_WIDTH, Math.round(px)))
    try {
      localStorage.setItem(ASSISTANT_CANVAS_WIDTH_STORAGE_KEY, String(clamped))
    }
    catch {}
    set({ canvasWidth: clamped })
  },
  setCanvasMobileOpen: v => set({ canvasMobileOpen: v }),
  setCanvasActiveTab: (tab) => {
    try {
      localStorage.setItem(ASSISTANT_CANVAS_TAB_STORAGE_KEY, tab)
    }
    catch {}
    set({ canvasActiveTab: tab })
  },
  // 自动切换请求：tab 被固定时忽略，避免切换会话/新消息时自动跳走
  requestCanvasTab: tab => set((state) => {
    if (state.canvasTabPinned)
      return {}
    try {
      localStorage.setItem(ASSISTANT_CANVAS_TAB_STORAGE_KEY, tab)
    }
    catch {}
    return { canvasActiveTab: tab }
  }),
  setCanvasTabPinned: (v) => {
    writeStoredBoolean(ASSISTANT_CANVAS_TAB_PINNED_STORAGE_KEY, v)
    set({ canvasTabPinned: v })
  },
  setUsageForMessage: (id, usage) => set(state => ({ usageByMessageId: { ...state.usageByMessageId, [id]: usage } })),
  setStreamingUsage: usage => set({ streamingUsage: usage }),
  bumpCanvasRefresh: () => set(state => ({ canvasRefreshTick: state.canvasRefreshTick + 1 })),
  setPreviewResumeId: id => set({ previewResumeId: id }),
  setTargetMessageId: id => set({ targetMessageId: id }),
  setAbortController: controller => set({ abortController: controller }),
  reset: () => set(state => ({
    activeConversationId: null,
    messages: [],
    streaming: false,
    streamingText: '',
    streamingParts: [],
    streamingUsage: null,
    pendingConversationId: null,
    conversationLoadRequestId: null,
    targetMessageId: null,
    canvasMobileOpen: false,
    // 固定后保持当前 tab，否则回到默认
    canvasActiveTab: state.canvasTabPinned ? state.canvasActiveTab : 'resume',
  })),
}))

export function cancelActiveAssistantRun(): void {
  const state = useAssistantStore.getState()
  state.pendingConfirm?.resolve(false)
  state.abortController?.abort()
  useAssistantStore.setState({
    streaming: false,
    streamingText: '',
    streamingParts: [],
    streamingUsage: null,
    abortController: null,
  })
}

export default useAssistantStore
