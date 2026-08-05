import type { ConversationSearchStatus } from '../../types'
import { DatabaseZap, SearchX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface SearchEmptyProps {
  status: ConversationSearchStatus
  onRetry: () => void
}

export default function ConversationSearchEmpty({ status, onRetry }: SearchEmptyProps) {
  if (status === 'idle' || status === 'ready')
    return null

  if (status === 'loading') {
    return (
      <div className="flex flex-col gap-2 p-3">
        {['search-skeleton-1', 'search-skeleton-2', 'search-skeleton-3'].map(key => (
          <Skeleton key={key} className="h-16 rounded-xl" />
        ))}
      </div>
    )
  }

  const unavailable = status === 'unavailable'

  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center text-sm">
      <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        {unavailable ? <DatabaseZap /> : <SearchX />}
      </div>
      <div className="text-center">
        <p className="text-sm font-medium">
          {status === 'empty'
            ? '没有匹配的历史记录'
            : unavailable
              ? '历史搜索尚未启用'
              : '搜索历史失败'}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {unavailable
            ? '请先应用 S5 数据库迁移。最近对话和聊天仍可正常使用。'
            : status === 'empty'
              ? '换一个关键词，或直接从最近对话中继续。'
              : '检查网络后重试，当前对话不会受到影响。'}
        </p>
      </div>
      {status === 'error' && (
        <Button size="sm" variant="outline" onClick={onRetry}>重新搜索</Button>
      )}
    </div>
  )
}
