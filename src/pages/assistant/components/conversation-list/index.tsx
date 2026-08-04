import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { deleteConversation, listMessages, updateConversation } from '@/lib/supabase/ai'
import { getErrorMessage } from '@/utils'
import useAssistantStore from '../../store'
import { ConversationItem } from './conversation-item'

const LIST_SKELETON_KEYS = ['conv-skeleton-1', 'conv-skeleton-2', 'conv-skeleton-3'] as const

interface ConversationListProps {
  onNavigate?: () => void
}

export default function ConversationList({ onNavigate }: ConversationListProps = {}) {
  const conversations = useAssistantStore(s => s.conversations)
  const activeId = useAssistantStore(s => s.activeConversationId)
  const loading = useAssistantStore(s => s.loadingConversations)

  const handleNew = () => {
    // 新会话延迟到首次发送时建库；这里仅清空当前选择进入空态
    useAssistantStore.getState().setActiveConversationId(null)
    useAssistantStore.getState().setMessages([])
    onNavigate?.()
  }

  const handleSelect = async (id: string) => {
    if (id === activeId) {
      onNavigate?.()
      return
    }
    useAssistantStore.getState().setActiveConversationId(id)
    useAssistantStore.getState().setLoadingMessages(true)
    onNavigate?.()
    try {
      const msgs = await listMessages(id)
      useAssistantStore.getState().setMessages(msgs)
    }
    catch (error) {
      toast.error('加载消息失败', { description: getErrorMessage(error) })
    }
    finally {
      useAssistantStore.getState().setLoadingMessages(false)
    }
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

  const handleDelete = async (id: string) => {
    try {
      await deleteConversation(id)
      useAssistantStore.getState().removeConversationLocal(id)
      toast.success('已删除会话')
    }
    catch (error) {
      toast.error('删除失败', { description: getErrorMessage(error) })
    }
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <Button className="w-full justify-start gap-2" variant="outline" onClick={handleNew}>
        <Plus className="size-4" />
        新对话
      </Button>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
        {loading
          ? LIST_SKELETON_KEYS.map(key => <Skeleton key={key} className="h-9 w-full rounded-lg" />)
          : conversations.length === 0
            ? <p className="px-3 py-6 text-center text-xs text-muted-foreground">还没有对话，点上方开始</p>
            : conversations.map(c => (
                <ConversationItem
                  key={c.id}
                  conversation={c}
                  active={c.id === activeId}
                  onSelect={handleSelect}
                  onRename={handleRename}
                  onDelete={handleDelete}
                />
              ))}
      </div>
    </div>
  )
}
