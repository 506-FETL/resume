import type { UploadedFile } from '@/components/ui/file-preview'
import type { AiMessage, AiMessagePart } from '@/lib/ai/types'
import { useCallback } from 'react'
import { toast } from 'sonner'
import { buildUserContext, runAgent } from '@/lib/ai/agent'
import {
  createConversation,
  deleteConversation,
  insertMessage,
  touchConversation,
  updateConversation,
} from '@/lib/supabase/ai'
import { getErrorMessage } from '@/utils'
import { CONVERSATION_TITLE_MAX_LEN, DEFAULT_CONVERSATION_TITLE } from '../const'
import useAssistantStore, { cancelActiveAssistantRun } from '../store'
import { writeLastConversationId } from '../utils'

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

// 把附件信息拼进发送文本（多模态后端链路暂未打通，此处透传文件名作为上下文提示）
function withAttachmentNote(text: string, files?: UploadedFile[]): string {
  const images = (files ?? []).filter(f => f.type.startsWith('image/'))
  if (images.length === 0)
    return text
  const names = images.map(f => f.name).join('、')
  const note = `（用户附带 ${images.length} 张图片：${names}）`
  return text ? `${text}\n\n${note}` : note
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
    const ownsCurrentRun = (expectedConversationId?: string) => {
      const state = useAssistantStore.getState()
      return state.abortController === controller
        && (!expectedConversationId || state.activeConversationId === expectedConversationId)
    }
    useAssistantStore.setState(state => ({
      messages: [...state.messages, localUser],
      streaming: true,
      streamingText: '',
      streamingParts: [],
      streamingUsage: null,
      abortController: controller,
    }))

    // 2. 后台确保会话存在
    let conversationId = useAssistantStore.getState().activeConversationId
    let isNewConversation = false
    try {
      if (!conversationId) {
        const conv = await createConversation(DEFAULT_CONVERSATION_TITLE)
        if (
          controller.signal.aborted
          || useAssistantStore.getState().abortController !== controller
        ) {
          await deleteConversation(conv.id).catch(() => undefined)
          return
        }
        conversationId = conv.id
        isNewConversation = true
        useAssistantStore.getState().upsertConversation(conv)
        useAssistantStore.getState().setActiveConversationId(conv.id)
        writeLastConversationId(conv.id)
      }
    }
    catch (error) {
      if (ownsCurrentRun()) {
        useAssistantStore.getState().removeMessage(localUser.id)
        useAssistantStore.setState({ streaming: false, streamingText: '', streamingParts: [], abortController: null })
        toast.error('创建会话失败', { description: getErrorMessage(error) })
      }
      return
    }

    // 3. 后台落库用户消息，成功后用服务端行替换本地临时行
    try {
      const savedUser = await insertMessage(conversationId, {
        role: 'user',
        parts: [{ type: 'text', text: trimmed }],
      })
      if (!ownsCurrentRun(conversationId))
        return
      useAssistantStore.getState().replaceMessage(localUser.id, savedUser)
    }
    catch (error) {
      if (ownsCurrentRun(conversationId)) {
        useAssistantStore.getState().removeMessage(localUser.id)
        useAssistantStore.setState({ streaming: false, streamingText: '', streamingParts: [], abortController: null })
        toast.error('发送失败', { description: getErrorMessage(error) })
      }
      return
    }

    // 4. 起 agent 循环，把回调事件映射到结构化进行中态 streamingParts
    const draft: AiMessagePart[] = []
    const pushDraft = () => {
      if (useAssistantStore.getState().abortController === controller)
        useAssistantStore.getState().setStreamingParts([...draft])
    }
    let reasoningIdx = -1
    let textIdx = -1
    let finalUsage: { input: number, output: number, total: number } | null = null

    try {
      const context = await buildUserContext().catch(() => undefined)
      const finalParts = await runAgent({
        history: useAssistantStore.getState().messages,
        signal: controller.signal,
        thinking: useAssistantStore.getState().deepThinking,
        context,
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
            draft.push({ type: 'tool-call', toolCallId: call.id, toolName: call.name, args: call.args, state: call.awaitingConfirm ? 'awaiting-confirm' : 'call' })
            // 工具调用后，后续文本/推理应另起新块
            textIdx = -1
            reasoningIdx = -1
            pushDraft()
          },
          onToolResult: (id, result, isError, cancelled) => {
            const i = draft.findIndex(p => p.type === 'tool-call' && p.toolCallId === id)
            if (i >= 0) {
              const prev = draft[i] as Extract<AiMessagePart, { type: 'tool-call' }>
              draft[i] = { ...prev, result, state: isError ? 'error' : cancelled ? 'cancelled' : 'result' }
            }
            pushDraft()
          },
          onUsage: (usage) => {
            finalUsage = usage
            if (useAssistantStore.getState().abortController === controller)
              useAssistantStore.getState().setStreamingUsage(usage)
          },
        },
      })

      // 5. 落库 assistant 消息（整轮完整 parts），原子关闭 streaming（避免双气泡）
      if (controller.signal.aborted)
        throw new DOMException('aborted', 'AbortError')
      const assistantMessage = await insertMessage(conversationId, { role: 'assistant', parts: finalParts })
      const current = useAssistantStore.getState()
      if (
        current.abortController === controller
        && current.activeConversationId === conversationId
      ) {
        if (finalUsage)
          useAssistantStore.getState().setUsageForMessage(assistantMessage.id, finalUsage)
        useAssistantStore.setState(state => ({
          messages: [...state.messages, assistantMessage],
          streaming: false,
          streamingText: '',
          streamingParts: [],
          streamingUsage: null,
          abortController: null,
        }))
      }

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
      if (useAssistantStore.getState().abortController === controller) {
        useAssistantStore.setState({
          streaming: false,
          streamingText: '',
          streamingParts: [],
          streamingUsage: null,
          abortController: null,
        })
      }
    }
  }, [])

  const sendMessage = useCallback((text: string, files?: UploadedFile[]) => {
    runSend(withAttachmentNote(text.trim(), files))
  }, [runSend])

  // 提取消息中的纯文本
  const messageText = (m: AiMessage): string =>
    m.parts.filter(p => p.type === 'text').map(p => (p as { text: string }).text).join('\n')

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
        lastUserText = messageText(m)
        continue // 该用户消息也移除，由 runSend 重新追加
      }
      kept.unshift(m)
    }
    if (!lastUserText)
      return
    useAssistantStore.getState().setMessages(kept)
    runSend(lastUserText.trim())
  }, [runSend])

  // 针对指定助手消息重新生成：截断其对应的上一条用户消息及之后所有消息，用该用户消息重跑
  const regenerateFrom = useCallback((assistantMessageId: string) => {
    const { messages, streaming } = useAssistantStore.getState()
    if (streaming)
      return
    const ai = messages.findIndex(m => m.id === assistantMessageId && m.role === 'assistant')
    if (ai < 0)
      return
    // 找到该助手消息前最近的一条用户消息
    let ui = -1
    for (let i = ai - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        ui = i
        break
      }
    }
    if (ui < 0)
      return
    const userText = messageText(messages[ui]).trim()
    if (!userText)
      return
    useAssistantStore.getState().setMessages(messages.slice(0, ui))
    runSend(userText)
  }, [runSend])

  // 编辑历史用户消息后重新生成：截断该用户消息及之后的所有消息，用新文本重跑
  const editUserMessageAndRerun = useCallback((userMessageId: string, newText: string) => {
    const { messages, streaming } = useAssistantStore.getState()
    if (streaming)
      return
    const trimmed = newText.trim()
    if (!trimmed)
      return
    const ui = messages.findIndex(m => m.id === userMessageId && m.role === 'user')
    if (ui < 0)
      return
    useAssistantStore.getState().setMessages(messages.slice(0, ui))
    runSend(trimmed)
  }, [runSend])

  const stopStreaming = useCallback(() => {
    cancelActiveAssistantRun()
  }, [])

  return { sendMessage, retryLast, regenerateFrom, editUserMessageAndRerun, stopStreaming }
}
