import { useShallow } from 'zustand/react/shallow'
import type { AiConversation } from '@/lib/ai/types'
import dayjs from 'dayjs'
import { useMemo } from 'react'
import { toast } from 'sonner'
import { AssistantConversationListSkeleton } from '@/components/page-skeletons/assistant'
import { updateConversation } from '@/lib/supabase/ai/conversations'
import { Button } from '@/components/ui/button'
import {
  loadMoreConversations,
  retryAssistantConversationList,
  useConversationReadScope,
} from '../../hooks/conversation-reads'
import { getErrorMessage } from '@/utils'
import { useAssistantNavigation } from '../../hooks/use-assistant-navigation'
import useAssistantStore from '../../store'
import { ConversationItem } from './conversation-item'
import { readableConversationTitle } from '../../composer-references'

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
  query?: string
}

export default function ConversationList({
  onNavigate,
  query = '',
}: ConversationListProps = {}) {
  const {
    conversations,
    activeConversationId: activeId,
    loadingConversations: loading,
    initializing,
    pendingConversationId,
    bootstrapError,
    conversationListError,
    nextConversationCursor,
    loadingMoreConversations,
  } = useAssistantStore(
    useShallow((state) => ({
      conversations: state.conversations,
      activeConversationId: state.activeConversationId,
      loadingConversations: state.loadingConversations,
      initializing: state.initializing,
      pendingConversationId: state.pendingConversationId,
      bootstrapError: state.bootstrapError,
      conversationListError: state.conversationListError,
      nextConversationCursor: state.nextConversationCursor,
      loadingMoreConversations: state.loadingMoreConversations,
    })),
  )

  const { openConversation, deleteAndSelectConversation } =
    useAssistantNavigation()

  const groups = useMemo(
    () =>
      groupConversations(
        conversations.filter((conversation) =>
          readableConversationTitle(conversation.title)
            .toLocaleLowerCase()
            .includes(query.trim().toLocaleLowerCase()),
        ),
      ),
    [conversations, query],
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
    const scope = useConversationReadScope.getState()

    try {
      const updated = await updateConversation(id, { title })

      if (scope === useConversationReadScope.getState())
        useAssistantStore.getState().upsertConversation(updated)
    } catch (error) {
      if (scope !== useConversationReadScope.getState()) return

      toast.error('重命名失败', { description: getErrorMessage(error) })
    }
  }

  if (loading && initializing && conversations.length === 0)
    return <AssistantConversationListSkeleton />

  const listRetry = conversationListError && (
    <div className='flex items-center justify-center gap-2 px-2 py-1 text-xs text-muted-foreground'>
      <span>对话列表加载失败</span>
      <Button
        size='sm'
        variant='ghost'
        disabled={loading}
        onClick={retryAssistantConversationList}
      >
        重试
      </Button>
    </div>
  )

  if (conversations.length === 0 && listRetry) return listRetry

  if (conversations.length === 0) {
    return (
      <div className='flex h-full min-h-0 items-start justify-center px-3 pt-8'>
        <p className='text-center text-xs text-muted-foreground'>
          {bootstrapError ? '对话暂时未能加载' : '暂无对话'}
        </p>
      </div>
    )
  }

  if (groups.length === 0 && query.trim())
    return (
      <p
        role='status'
        className='px-3 py-8 text-center text-sm text-muted-foreground'
      >
        近期对话中没有找到，可以搜索全部历史。
      </p>
    )

  return (
    <div
      aria-busy={loading || loadingMoreConversations}
      className='min-h-0 flex-1 overflow-y-auto px-2 pb-2'
    >
      <div className='flex flex-col gap-4'>
        {listRetry}
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
        {nextConversationCursor && !query.trim() && (
          <Button
            variant='ghost'
            size='sm'
            disabled={loadingMoreConversations}
            onClick={() =>
              loadMoreConversations(nextConversationCursor).catch(
                (error: unknown) =>
                  toast.error('加载更早对话失败', {
                    description: getErrorMessage(error),
                  }),
              )
            }
          >
            {loadingMoreConversations ? '正在加载…' : '加载更早对话'}
          </Button>
        )}
      </div>
    </div>
  )
}
