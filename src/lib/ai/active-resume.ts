import useAssistantStore from '@/pages/assistant/store'

// 解析「AI 助手当前会话正在操作的简历」：严格取当前会话绑定的简历（与画布预览
// use-canvas-preview 的 boundResumeId 同源），不回退到全局当前编辑简历。
//
// 会话已改为「每个对话各自管理正在操作的简历」，写操作 / 撤销 / 上下文必须只跟随
// 该会话的绑定，否则会话 A 的操作会误写到全局当前简历（可能是其它会话正在编辑的
// 简历）上。未绑定时返回 null，由调用方提示用户先在本会话打开简历。
export function resolveActiveResumeId(): string | null {
  const { activeConversationId, conversations } = useAssistantStore.getState()
  if (!activeConversationId)
    return null
  return conversations.find(conversation => conversation.id === activeConversationId)?.resumeId ?? null
}
