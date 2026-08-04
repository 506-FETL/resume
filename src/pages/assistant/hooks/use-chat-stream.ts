import type { AiMessage, AiMessagePart } from '@/lib/ai/types'
import { useCallback } from 'react'
import { toast } from 'sonner'
import { runAgent } from '@/lib/ai/agent'
import {
  createConversation,
  insertMessage,
  touchConversation,
  updateConversation,
} from '@/lib/supabase/ai'
import { getErrorMessage } from '@/utils'
import { CONVERSATION_TITLE_MAX_LEN, DEFAULT_CONVERSATION_TITLE } from '../const'
import useAssistantStore from '../store'

// 构造一条本地临时消息（乐观上屏，稍后用服务端返回替换）
function makeLocalMessage(role: AiMessage['role'], text: string): AiMessage {
  return {
    id: `local-${crypto.randomUUID()}`,
    conversationId: '',
    userId: '',
    role,
    parts: [{ type: 'text', text }],
    createdAt: new Date().toISOString(),
  }
}

export function useChatStream() {
  // 核心发送：先乐观上屏，再后台落库 + 起流
  const runSend = useCallback(async (trimmed: string) => {
    if (!trimmed)
      return
    if (useAssistantStore.getState().streaming)
      return

    // 1. 立即乐观上屏用户气泡 + 进入 streaming（同步，无 await，杜绝延迟）
    const localUser = makeLocalMessage('user', trimmed)
    const controller = new AbortController()
    useAssistantStore.setState(state => ({
      messages: [...state.messages, localUser],
      streaming: true,
      streamingText: '',
      streamingParts: [],
      abortController: controller,
    }))

    // 2. 后台确保会话存在
    let conversationId = useAssistantStore.getState().activeConversationId
    let isNewConversation = false
    try {
      if (!conversationId) {
        const conv = await createConversation(DEFAULT_CONVERSATION_TITLE)
        conversationId = conv.id
        isNewConversation = true
        useAssistantStore.getState().upsertConversation(conv)
        useAssistantStore.getState().setActiveConversationId(conv.id)
      }
    }
    catch (error) {
      useAssistantStore.getState().removeMessage(localUser.id)
      useAssistantStore.setState({ streaming: false, streamingText: '', streamingParts: [], abortController: null })
      toast.error('创建会话失败', { description: getErrorMessage(error) })
      return
    }

    // 3. 后台落库用户消息，成功后用服务端行替换本地临时行
    try {
      const savedUser = await insertMessage(conversationId, {
        role: 'user',
        parts: [{ type: 'text', text: trimmed }],
      })
      useAssistantStore.getState().replaceMessage(localUser.id, savedUser)
    }
    catch (error) {
      useAssistantStore.getState().removeMessage(localUser.id)
      useAssistantStore.setState({ streaming: false, streamingText: '', streamingParts: [], abortController: null })
      toast.error('发送失败', { description: getErrorMessage(error) })
      return
    }

    // 4. 起 agent 循环，把回调事件映射到结构化进行中态 streamingParts
    const draft: AiMessagePart[] = []
    const pushDraft = () => useAssistantStore.getState().setStreamingParts([...draft])
    let reasoningIdx = -1
    let textIdx = -1

    try {
      const finalParts = await runAgent({
        history: useAssistantStore.getState().messages,
        signal: controller.signal,
        callbacks: {
          onReasoning: (full) => {
            if (reasoningIdx < 0) {
              draft.push({ type: 'reasoning', text: full })
              reasoningIdx = draft.length - 1
            }
            else {
              draft[reasoningIdx] = { type: 'reasoning', text: full }
            }
            pushDraft()
          },
          onText: (full) => {
            if (textIdx < 0) {
              draft.push({ type: 'text', text: full })
              textIdx = draft.length - 1
            }
            else {
              draft[textIdx] = { type: 'text', text: full }
            }
            pushDraft()
          },
          onToolCallStart: (call) => {
            draft.push({ type: 'tool-call', toolCallId: call.id, toolName: call.name, args: call.args, state: 'call' })
            // 工具调用后，后续文本/推理应另起新块
            textIdx = -1
            reasoningIdx = -1
            pushDraft()
          },
          onToolResult: (id, result, isError) => {
            const i = draft.findIndex(p => p.type === 'tool-call' && p.toolCallId === id)
            if (i >= 0) {
              const prev = draft[i] as Extract<AiMessagePart, { type: 'tool-call' }>
              draft[i] = { ...prev, result, state: isError ? 'error' : 'result' }
            }
            pushDraft()
          },
        },
      })

      // 5. 落库 assistant 消息（整轮完整 parts），原子关闭 streaming（避免双气泡）
      const assistantMessage = await insertMessage(conversationId, { role: 'assistant', parts: finalParts })
      useAssistantStore.setState(state => ({
        messages: [...state.messages, assistantMessage],
        streaming: false,
        streamingText: '',
        streamingParts: [],
        abortController: null,
      }))

      // 6. 刷新排序；首条消息生成标题
      await touchConversation(conversationId)
      if (isNewConversation) {
        const title = trimmed.slice(0, CONVERSATION_TITLE_MAX_LEN)
        const updated = await updateConversation(conversationId, { title })
        useAssistantStore.getState().upsertConversation(updated)
      }
    }
    catch (error) {
      if ((error as Error)?.name !== 'AbortError') {
        toast.error('回复失败', { description: getErrorMessage(error) })
      }
      useAssistantStore.setState({ streaming: false, streamingText: '', streamingParts: [], abortController: null })
    }
  }, [])

  const sendMessage = useCallback((text: string) => {
    runSend(text.trim())
  }, [runSend])

  // 重试：移除最后一条助手消息（若有），以最后一条用户消息重新发送
  const retryLast = useCallback(() => {
    const { messages, streaming } = useAssistantStore.getState()
    if (streaming || messages.length === 0)
      return
    let lastUserText: string | null = null
    const kept: AiMessage[] = []
    // 从后往前：丢弃末尾的助手消息，定位最后一条用户消息
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      if (lastUserText === null && m.role === 'assistant')
        continue
      if (lastUserText === null && m.role === 'user') {
        lastUserText = m.parts.filter(p => p.type === 'text').map(p => (p as { text: string }).text).join('\n')
        continue // 该用户消息也移除，由 runSend 重新追加
      }
      kept.unshift(m)
    }
    if (!lastUserText)
      return
    useAssistantStore.getState().setMessages(kept)
    runSend(lastUserText.trim())
  }, [runSend])

  const stopStreaming = useCallback(() => {
    useAssistantStore.getState().abortController?.abort()
  }, [])

  return { sendMessage, retryLast, stopStreaming }
}
