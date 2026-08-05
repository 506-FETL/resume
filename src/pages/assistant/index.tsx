import AssistantSidebar from './components/assistant-sidebar'
import ChatHeader from './components/chat-header'
import Composer from './components/composer'
import ConversationSearch from './components/conversation-search'
import MessageList from './components/message-list'
import { useAssistantBootstrap } from './hooks/use-assistant-bootstrap'
import { useAssistantNavigation } from './hooks/use-assistant-navigation'
import { useWriteConfirmBridge } from './hooks/use-write-confirm-bridge'

export default function Assistant() {
  useWriteConfirmBridge()
  useAssistantBootstrap()
  useAssistantNavigation(true)

  return (
    <div className="flex h-dvh min-h-0 w-full overflow-hidden bg-background">
      <AssistantSidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <ChatHeader />
        <div className="min-h-0 flex-1 overflow-hidden">
          <MessageList />
        </div>
        <div className="shrink-0 border-t bg-background/90 py-3 backdrop-blur">
          <Composer />
        </div>
      </div>
      <ConversationSearch />
    </div>
  )
}
