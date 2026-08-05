import { MessageSquare, Search } from 'lucide-react'
import { useEffect } from 'react'
import {
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Spinner } from '@/components/ui/spinner'
import { CONVERSATION_BOTTOM_TARGET, CONVERSATION_SEARCH_MIN_LENGTH } from '../../const'
import { useAssistantNavigation } from '../../hooks/use-assistant-navigation'
import { useConversationSearch } from '../../hooks/use-conversation-search'
import useAssistantStore from '../../store'
import SearchEmpty from './search-empty'
import ConversationSearchResult from './search-result'

export default function ConversationSearch() {
  const { searchOpen, setSearchOpen, conversations } = useAssistantStore()
  const { openConversation } = useAssistantNavigation()
  const {
    query,
    setQuery,
    results,
    status,
    hasMore,
    loadingMore,
    loadMore,
    retry,
    reset,
  } = useConversationSearch(searchOpen)
  const normalizedQuery = query.trim()
  const showRecent = normalizedQuery.length < CONVERSATION_SEARCH_MIN_LENGTH

  useEffect(() => {
    if (searchOpen)
      return

    const timer = window.setTimeout(reset, 200)
    return () => window.clearTimeout(timer)
  }, [reset, searchOpen])

  return (
    <CommandDialog
      open={searchOpen}
      onOpenChange={setSearchOpen}
      title="搜索对话历史"
      description="搜索会话标题和历史消息正文"
      commandProps={{ shouldFilter: false }}
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="搜索对话与消息…"
      />
      <CommandList className="max-h-[min(60vh,480px)]">
        {showRecent
          ? (
              <CommandGroup heading="最近对话">
                {conversations.slice(0, 8).map(conversation => (
                  <CommandItem
                    key={conversation.id}
                    value={conversation.id}
                    onSelect={() => openConversation(conversation.id)}
                  >
                    <MessageSquare />
                    <span className="truncate">{conversation.title}</span>
                  </CommandItem>
                ))}
                {conversations.length === 0 && (
                  <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                    <Search className="size-5 text-muted-foreground" />
                    <p className="text-sm font-medium">还没有历史对话</p>
                    <p className="text-xs text-muted-foreground">输入消息开始第一段对话。</p>
                  </div>
                )}
              </CommandGroup>
            )
          : (
              <CommandGroup heading="搜索结果">
                {results.map(result => (
                  <ConversationSearchResult
                    key={`${result.matchType}:${result.conversationId}:${result.messageId ?? 'title'}`}
                    result={result}
                    query={normalizedQuery}
                    onSelect={() => openConversation(result.conversationId, {
                      targetMessageId: result.messageId ?? CONVERSATION_BOTTOM_TARGET,
                      closeOverlays: true,
                    })}
                  />
                ))}
              </CommandGroup>
            )}

        {!showRecent && <SearchEmpty status={status} onRetry={retry} />}

        {!showRecent && status === 'ready' && hasMore && (
          <CommandGroup>
            <CommandItem
              value="load-more-search-results"
              disabled={loadingMore}
              onSelect={loadMore}
            >
              {loadingMore && <Spinner />}
              <span>{loadingMore ? '正在加载…' : '加载更多'}</span>
            </CommandItem>
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}
