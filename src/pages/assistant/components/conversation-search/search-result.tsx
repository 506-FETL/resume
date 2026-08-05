import type { AiConversationSearchResult } from '@/lib/ai/types'
import { Bot, MessageSquareText, UserRound } from 'lucide-react'
import { CommandItem } from '@/components/ui/command'
import { formatRelativeTime } from '@/utils'

interface SearchResultProps {
  result: AiConversationSearchResult
  query: string
  onSelect: () => void
}

function HighlightedText({ text, query }: { text: string, query: string }) {
  const normalizedText = text.toLocaleLowerCase()
  const normalizedQuery = query.toLocaleLowerCase()
  const index = normalizedText.indexOf(normalizedQuery)

  if (index < 0 || !normalizedQuery)
    return text

  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded-sm bg-primary/15 px-0.5 text-foreground">
        {text.slice(index, index + query.length)}
      </mark>
      {text.slice(index + query.length)}
    </>
  )
}

export default function ConversationSearchResult({
  result,
  query,
  onSelect,
}: SearchResultProps) {
  const RoleIcon = result.role === 'user' ? UserRound : Bot
  const roleLabel = result.role === 'user' ? '你' : 'AI 助手'

  return (
    <CommandItem
      value={`${result.conversationId}:${result.messageId ?? 'title'}`}
      className="items-start gap-3 rounded-xl px-3 py-3"
      onSelect={onSelect}
    >
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        {result.matchType === 'title' ? <MessageSquareText /> : <RoleIcon />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">
            <HighlightedText text={result.conversationTitle} query={query} />
          </p>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {formatRelativeTime(result.matchedAt)}
          </span>
        </div>
        <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {result.matchType === 'title' ? '会话标题' : roleLabel}
        </p>
        {result.matchType === 'message' && (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            <HighlightedText text={result.excerpt} query={query} />
          </p>
        )}
      </div>
    </CommandItem>
  )
}
