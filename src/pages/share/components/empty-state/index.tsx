import { Link2, SearchX } from 'lucide-react'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'

interface ShareEmptyStateProps {
  filtered: boolean
}

export default function ShareEmptyState({ filtered }: ShareEmptyStateProps) {
  return (
    <Empty className="min-h-90 border border-dashed bg-muted/20">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          {filtered ? <SearchX /> : <Link2 />}
        </EmptyMedia>
        <EmptyTitle>{filtered ? '没有匹配的分享链接' : '还没有分享链接'}</EmptyTitle>
        <EmptyDescription>
          {filtered ? '调整搜索或筛选条件。' : '从任意云端简历创建一个只读链接。'}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
