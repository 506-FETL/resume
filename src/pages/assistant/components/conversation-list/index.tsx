import { useShallow } from 'zustand/react/shallow'
import type { AiConversation } from '@/lib/ai/types'
import dayjs from 'dayjs'
import { useMemo } from 'react'
import { toast } from 'sonner'
import { AssistantConversationListSkeleton } from '@/components/page-skeletons/assistant'
import { updateConversation } from '@/lib/supabase/ai'
import { getErrorMessage } from '@/utils'
import { useAssistantNavigation } from '../../hooks/use-assistant-navigation'
import useAssistantStore from '../../store'
import { ConversationItem } from './conversation-item'

interface ConversationGroup {
  key: string
  label: string
  items: AiConversation[]
}

// 按更新时间分组：今天 / 昨天 / 近 7 天 / 更早（列表已按 updatedAt desc 排序）
function groupConversations(list: AiConversation[]): ConversationGroup[] {
  const startOfToday = dayjs().startOf('day')
  const startOfYesterday = startOfToday.subtract(1, 'day')
  const startOfWeek = startOfToday.subtract(7, 'day')

  const groups: ConversationGroup[] = [
    { key: 'today', label: '今天', items: [] },
    { key: 'yesterday', label: '昨天', items: [] },
    { key: 'week', label: '近 7 天', items: [] },
    { key: 'earlier', label: '更早', items: [] },
  ]

  for (const conv of list) {
    const updated = dayjs(conv.updatedAt)

    if (!updated.isValid() || !updated.isBefore(startOfToday))
      groups[0].items.push(conv)
    else if (!updated.isBefore(startOfYesterday)) groups[1].items.push(conv)
    else if (!updated.isBefore(startOfWeek)) groups[2].items.push(conv)
    else groups[3].items.push(conv)
  }

  return groups.filter((group) => group.items.length > 0)
}

interface ConversationListProps {
  onNavigate?: () => void
}

export default function ConversationList({
  onNavigate,
}: ConversationListProps = {}) {
  const {
    conversations,
    activeConversationId: activeId,
    loadingConversations: loading,
    initializing,
    pendingConversationId,
    bootstrapError,
  } = useAssistantStore(
    useShallow((state) => ({
      conversations: state.conversations,
      activeConversationId: state.activeConversationId,
      loadingConversations: state.loadingConversations,
      initializing: state.initializing,
      pendingConversationId: state.pendingConversationId,
      bootstrapError: state.bootstrapError,
    })),
  )

  const { openConversation, deleteAndSelectConversation } =
    useAssistantNavigation()

  const groups = useMemo(
    () => groupConversations(conversations),
    [conversations],
  )

  const handleSelect = async (id: string) => {
    if (id === activeId && !pendingConversationId) {
      onNavigate?.()

      return
    }

    const opened = await openConversation(id)

    if (opened) onNavigate?.()
  }

  const handleRename = async (id: string, title: string) => {
    try {
      const updated = await updateConversation(id, { title })

      useAssistantStore.getState().upsertConversation(updated)
    } catch (error) {
      toast.error('重命名失败', { description: getErrorMessage(error) })
    }
  }

  if (loading && initializing && conversations.length === 0)
    return <AssistantConversationListSkeleton />

  if (conversations.length === 0) {
    return (
      <div className='flex h-full min-h-0 items-start justify-center px-3 pt-8'>
        <p className='text-center text-xs text-muted-foreground'>
          {bootstrapError ? '对话暂时未能加载' : '暂无对话'}
        </p>
      </div>
    )
  }

  return (
    <div
      aria-busy={loading}
      className='min-h-0 flex-1 overflow-y-auto px-2 pb-2'
    >
      <div className='flex flex-col gap-4'>
        {groups.map((group) => (
          <div key={group.key} className='flex flex-col gap-0.5'>
            <p className='px-2 pb-1.5 text-xs font-medium text-muted-foreground'>
              {group.label}
            </p>
            {group.items.map((c) => (
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
        ))}
      </div>
    </div>
  )
}
