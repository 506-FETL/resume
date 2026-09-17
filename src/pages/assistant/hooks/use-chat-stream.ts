import type { AiMessage, AiMessagePart, AiSkillReference } from '@/lib/ai/types'
import { useCallback } from 'react'
import { toast } from 'sonner'
import { buildUserContext, runAgent } from '@/lib/ai/agent'
import { createSkillReferences, createUserParts, getSkillReferences } from '@/lib/ai/skills/references'
import { QuotaExceededError } from '@/lib/llm/call'
import { createConversation, deleteConversation, insertMessage, touchConversation, updateConversation } from '@/lib/supabase/ai'
import { refetchAiQuota } from '@/store/ai-quota'
import { openUpgradeDialog } from '@/store/upgrade-dialog'
import { getErrorMessage } from '@/utils'
import { CONVERSATION_TITLE_MAX_LEN, DEFAULT_CONVERSATION_TITLE } from '../const'
import useAssistantStore, { cancelActiveAssistantRun } from '../store'
import { TOOL_CANVAS_META, writeLastConversationId } from '../utils'
import { invalidateCanvasSnapshot } from './use-canvas-preview'

// 构造一条本地临时消息（乐观上屏，稍后用服务端返回替换）
function makeLocalMessage(role: AiMessage['role'], parts: AiMessagePart[]): AiMessage {
  return {
    id: `local-${crypto.randomUUID()}`,
    conversationId: '',
    userId: '',
    role,
    parts,
    createdAt: new Date().toISOString(),
  }
}

export function useChatStream() {
  // 核心发送：先乐观上屏，再后台落库 + 起流
  const runSend = useCallback(async (trimmed: string, references: AiSkillReference[] = []) => {
    if (!trimmed)
      return
    const initialState = useAssistantStore.getState()
    const initialConversationId = initialState.activeConversationId
    if (initialState.streaming || (initialConversationId && initialState.inFlightConversationIds[initialConversationId]))
      return

    // 1. 立即乐观上屏用户气泡 + 进入 streaming（同步，无 await，杜绝延迟）
    const userParts = createUserParts(trimmed, references)
    const localUser = makeLocalMessage('user', userParts)
    const controller = new AbortController()
    let lockedConversationId = initialConversationId
    const lockConversation = (id: string) => {
      lockedConversationId = id
      useAssistantStore.getState().beginConversationRun(id)
    }
    const finishConversationRun = () => {
      if (lockedConversationId) {
        useAssistantStore.getState().finishConversationRun(lockedConversationId)
        lockedConversationId = null
      }
    }
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
    if (initialConversationId)
      lockConversation(initialConversationId)

    // 2. 后台确保会话存在
    let conversationId = initialConversationId
    let isNewConversation = false
    try {
      if (!conversationId) {
        const conv = await createConversation(DEFAULT_CONVERSATION_TITLE)
        if (
          controller.signal.aborted
          || useAssistantStore.getState().abortController !== controller
        ) {
          await deleteConversation(conv.id).catch(() => undefined)
          useAssistantStore.getState().removeMessage(localUser.id)
          finishConversationRun()
          return
        }
        conversationId = conv.id
        isNewConversation = true
        lockConversation(conv.id)
        useAssistantStore.getState().upsertConversation(conv)
        useAssistantStore.getState().setActiveConversationId(conv.id)
        writeLastConversationId(conv.id)
      }
    }
    catch (error) {
      if (ownsCurrentRun()) {
        useAssistantStore.getState().removeMessage(localUser.id)
        useAssistantStore.setState({ streaming: false, streamingText: '', streamingParts: [], abortController: null, composerDraft: trimmed, composerSkillIds: references.map(reference => reference.skillId) })
        toast.error('创建会话失败', { description: getErrorMessage(error) })
      }
      finishConversationRun()
      return
    }

    // 3. 落库用户消息，用服务端行替换本地临时行
    try {
      const savedUser = await insertMessage(conversationId, {
        role: 'user',
        parts: userParts,
      })
      if (!ownsCurrentRun(conversationId)) {
        const state = useAssistantStore.getState()
        if (state.activeConversationId === conversationId && !state.abortController)
          state.replaceMessage(localUser.id, savedUser)
        finishConversationRun()
        return
      }
      useAssistantStore.getState().replaceMessage(localUser.id, savedUser)
    }
    catch (error) {
      if (ownsCurrentRun(conversationId)) {
        useAssistantStore.getState().removeMessage(localUser.id)
        useAssistantStore.setState({ streaming: false, streamingText: '', streamingParts: [], abortController: null, composerDraft: trimmed, composerSkillIds: references.map(reference => reference.skillId) })
        toast.error('发送失败', { description: getErrorMessage(error) })
      }
      finishConversationRun()
      return
    }

    // 4. 起 agent 循环，把回调事件映射到结构化进行中态 streamingParts
    const draft: AiMessagePart[] = []
    // 用 requestAnimationFrame 合帧：高频 token 回调在一帧内只触发一次 store 更新，避免逐 token 重渲染卡顿
    let rafId: number | null = null
    const pushDraft = () => {
      if (rafId != null)
        return
      rafId = requestAnimationFrame(() => {
        rafId = null
        if (useAssistantStore.getState().abortController === controller)
          useAssistantStore.getState().setStreamingParts([...draft])
      })
    }
    const cancelPushDraft = () => {
      if (rafId != null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
    }
    let reasoningIdx = -1
    let textIdx = -1
    let finalUsage: { input: number, output: number, total: number } | null = null
    let assistantSaved = false
    const history = useAssistantStore.getState().messages
    const thinking = useAssistantStore.getState().deepThinking

    try {
      const context = await buildUserContext().catch(() => undefined)
      if (controller.signal.aborted)
        throw new DOMException('aborted', 'AbortError')
      const finalParts = await runAgent({
        history,
        signal: controller.signal,
        thinking,
        context,
        callbacks: {
          onSkillActivity: (activity) => {
            const index = draft.findIndex(part => part.type === 'skill-activity' && part.id === activity.id)
            if (index < 0)
              draft.push(activity)
            else
              draft[index] = activity
            pushDraft()
          },
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
          onToolCallPending: (call) => {
            // 已存在同 id 的工具行则跳过，避免重复
            const exists = draft.some(p => p.type === 'tool-call' && p.toolCallId === call.id)
            if (!exists) {
              draft.push({ type: 'tool-call', toolCallId: call.id, toolName: call.name, step: call.step, args: {}, state: 'call' })
              textIdx = -1
              reasoningIdx = -1
              pushDraft()
            }
          },
          onToolCallStart: (call) => {
            const i = draft.findIndex(p => p.type === 'tool-call' && p.toolCallId === call.id)
            const next = { type: 'tool-call' as const, toolCallId: call.id, toolName: call.name, step: call.step, args: call.args, state: call.awaitingConfirm ? 'awaiting-confirm' as const : 'call' as const }
            if (i >= 0)
              draft[i] = next
            else
              draft.push(next)
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
              // 简历写操作成功：清掉快照缓存并强制画布刷新，保证右侧画布重新拉取最新 DB 数据
              // （对齐撤销路径的 bumpCanvasRefresh，避免写后仍命中旧缓存导致「画布不刷新」）
              if (!isError && !cancelled && TOOL_CANVAS_META[prev.toolName]?.category === 'resume') {
                invalidateCanvasSnapshot()
                useAssistantStore.getState().bumpCanvasRefresh()
              }
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
      assistantSaved = true
      const current = useAssistantStore.getState()
      if (
        current.activeConversationId === conversationId
        && (!current.abortController || current.abortController === controller)
      ) {
        cancelPushDraft()
        if (finalUsage)
          useAssistantStore.getState().setUsageForMessage(assistantMessage.id, finalUsage)
        if (current.abortController === controller) {
          useAssistantStore.setState(state => ({
            messages: [...state.messages, assistantMessage],
            streaming: false,
            streamingText: '',
            streamingParts: [],
            streamingUsage: null,
            abortController: null,
          }))
        }
        else {
          current.appendMessage(assistantMessage)
        }
      }
      finishConversationRun()

      // 6. 刷新排序；首条消息生成标题
      await touchConversation(conversationId)
      if (isNewConversation) {
        const title = trimmed.slice(0, CONVERSATION_TITLE_MAX_LEN)
        const updated = await updateConversation(conversationId, { title })
        useAssistantStore.getState().upsertConversation(updated)
      }
      // 7. 本轮成功：以服务端权威额度校正各展示位（composer / 账户菜单 / 用户中心）
      refetchAiQuota()
    }
    catch (error) {
      cancelPushDraft()
      // 停止/失败仍保留已经发生的技能和工具活动，且不写入后来切换的新会话。
      if (!assistantSaved && draft.length > 0) {
        const interrupted: AiMessagePart[] = draft.map((part) => {
          if (part.type === 'tool-call' && (part.state === 'call' || part.state === 'awaiting-confirm'))
            return { ...part, state: 'cancelled', result: { cancelled: true, message: '本轮已停止，工具未完成。' } }
          if (part.type === 'skill-activity' && part.state === 'loading')
            return { ...part, state: 'error', error: '加载已停止' }
          return part
        })
        interrupted.push({ type: 'text', text: controller.signal.aborted ? '已停止本次回复，以上为已完成的进展。' : `本次回复未完成：${getErrorMessage(error)}` })
        try {
          const saved = await insertMessage(conversationId, { role: 'assistant', parts: interrupted })
          const state = useAssistantStore.getState()
          if (state.activeConversationId === conversationId && (!state.abortController || state.abortController === controller))
            state.appendMessage(saved)
        }
        catch {
          const state = useAssistantStore.getState()
          if (state.activeConversationId === conversationId && (!state.abortController || state.abortController === controller))
            state.appendMessage({ ...makeLocalMessage('assistant', interrupted), conversationId })
        }
      }
      if ((error as Error)?.name !== 'AbortError') {
        // 额度超限：打开升级占位 Dialog（携带恢复时间），并以服务端额度校正展示位
        if (error instanceof QuotaExceededError) {
          openUpgradeDialog({ reason: 'quota_exceeded', resetAt: error.resetAt ?? null })
          refetchAiQuota()
        }
        else {
          toast.error('回复失败', { description: getErrorMessage(error) })
        }
      }
      if (useAssistantStore.getState().abortController === controller) {
        cancelPushDraft()
        useAssistantStore.setState({
          streaming: false,
          streamingText: '',
          streamingParts: [],
          streamingUsage: null,
          abortController: null,
        })
      }
      finishConversationRun()
    }
  }, [])

  const sendMessage = useCallback((text: string, skillIds: string[] = []): boolean => {
    const state = useAssistantStore.getState()
    if (state.streaming)
      return false
    if (state.activeConversationId && state.inFlightConversationIds[state.activeConversationId]) {
      toast.info('正在保存上一轮进展，请稍后发送')
      return false
    }
    try {
      const references = createSkillReferences(text, skillIds)
      const trimmed = text.trim() || (references.length ? '请使用所选技能，帮助我优化当前简历。' : '')
      if (!trimmed)
        return false
      runSend(trimmed, references)
      return true
    }
    catch (error) {
      toast.error('无法调用技能', { description: getErrorMessage(error) })
      return false
    }
  }, [runSend])

  // 提取消息中的纯文本
  const messageText = (m: AiMessage): string =>
    m.parts.filter(p => p.type === 'text').map(p => (p as { text: string }).text).join('\n')

  // 重试：移除最后一条助手消息（若有），以最后一条用户消息重新发送
  const retryLast = useCallback(() => {
    const { messages, streaming, activeConversationId, inFlightConversationIds } = useAssistantStore.getState()
    if (streaming || (activeConversationId && inFlightConversationIds[activeConversationId]) || messages.length === 0)
      return
    let lastUser: AiMessage | null = null
    const kept: AiMessage[] = []
    // 从后往前：丢弃末尾的助手消息，定位最后一条用户消息
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      if (lastUser === null && m.role === 'assistant')
        continue
      if (lastUser === null && m.role === 'user') {
        lastUser = m
        continue // 该用户消息也移除，由 runSend 重新追加
      }
      kept.unshift(m)
    }
    if (!lastUser)
      return
    useAssistantStore.getState().setMessages(kept)
    runSend(messageText(lastUser).trim(), getSkillReferences(lastUser.parts))
  }, [runSend])

  // 针对指定助手消息重新生成：截断其对应的上一条用户消息及之后所有消息，用该用户消息重跑
  const regenerateFrom = useCallback((assistantMessageId: string) => {
    const { messages, streaming, activeConversationId, inFlightConversationIds } = useAssistantStore.getState()
    if (streaming || (activeConversationId && inFlightConversationIds[activeConversationId]))
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
    runSend(userText, getSkillReferences(messages[ui].parts))
  }, [runSend])

  // 编辑历史用户消息后重新生成：截断该用户消息及之后的所有消息，用新文本重跑
  const editUserMessageAndRerun = useCallback((userMessageId: string, newText: string) => {
    const { messages, streaming, activeConversationId, inFlightConversationIds } = useAssistantStore.getState()
    if (streaming || (activeConversationId && inFlightConversationIds[activeConversationId]))
      return
    const trimmed = newText.trim()
    const ui = messages.findIndex(m => m.id === userMessageId && m.role === 'user')
    if (ui < 0 || !trimmed)
      return
    try {
      const references = createSkillReferences(trimmed)
      useAssistantStore.getState().setMessages(messages.slice(0, ui))
      runSend(trimmed, references)
    }
    catch (error) {
      toast.error('无法调用技能', { description: getErrorMessage(error) })
    }
  }, [runSend])

  const stopStreaming = useCallback(() => {
    cancelActiveAssistantRun()
  }, [])

  return { sendMessage, retryLast, regenerateFrom, editUserMessageAndRerun, stopStreaming }
}
