import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { updateConversation } from '@/lib/supabase/ai'
import { getErrorMessage } from '@/utils'
import { useAssistantNavigation } from '../../hooks/use-assistant-navigation'
import useAssistantStore from '../../store'
import { ConversationItem } from './conversation-item'

const LIST_SKELETON_KEYS = ['conv-skeleton-1', 'conv-skeleton-2', 'conv-skeleton-3'] as const

interface ConversationListProps {
  onNavigate?: () => void
}

export default function ConversationList({ onNavigate }: ConversationListProps = {}) {
  const {
    conversations,
    activeConversationId: activeId,
    loadingConversations: loading,
    pendingConversationId,
  } = useAssistantStore()
  const { openConversation, deleteAndSelectConversation } = useAssistantNavigation()

  const handleSelect = async (id: string) => {
    if (id === activeId && !pendingConversationId) {
      onNavigate?.()
      return
    }
    const opened = await openConversation(id)
    if (opened)
      onNavigate?.()
  }

  const handleRename = async (id: string, title: string) => {
    try {
      const updated = await updateConversation(id, { title })
      useAssistantStore.getState().upsertConversation(updated)
    }
    catch (error) {
      toast.error('重命名失败', { description: getErrorMessage(error) })
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <p className="px-2 pb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          最近对话
        </p>
        <div className="flex flex-col gap-1">
          {loading
            ? LIST_SKELETON_KEYS.map(key => <Skeleton key={key} className="h-9 w-full rounded-lg" />)
            : conversations.length === 0
              ? <p className="px-3 py-6 text-center text-xs text-muted-foreground">还没有对话，点上方开始</p>
              : conversations.map(c => (
                  <ConversationItem
                    key={c.id}
                    conversation={c}
                    active={c.id === activeId}
                    pending={c.id === pendingConversationId}
                    onSelect={handleSelect}
                    onRename={handleRename}
                    onDelete={deleteAndSelectConversation}
                  />
                ))}
        </div>
      </div>
    </div>
  )
}
