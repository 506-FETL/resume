import type useAssistantStore from '../../store'

export type MessageViewSnapshot = Pick<
  ReturnType<typeof useAssistantStore.getState>,
  | 'initializing'
  | 'bootstrapError'
  | 'loadingMessages'
  | 'pendingConversationId'
  | 'messages'
  | 'streaming'
  | 'activeConversationId'
  | 'streamingParts'
  | 'pendingConfirm'
  | 'conversationViewVersion'
  | 'targetMessageId'
  | 'setTargetMessageId'
  | 'hasMoreMessages'
  | 'loadingOlder'
  | 'olderMessagesError'
  | 'historicalMatch'
>
