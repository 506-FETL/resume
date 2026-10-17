import { Link2, SearchX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { useShareFilterActions } from '../../hooks/use-share-filter-actions'

interface EmptyStateProps {
  filtered: boolean
}

export default function EmptyState({ filtered }: EmptyStateProps) {
  const { resetFilters } = useShareFilterActions()
  return (
    <Empty className="min-h-80 rounded-2xl border border-dashed bg-muted/15">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          {filtered ? <SearchX /> : <Link2 />}
        </EmptyMedia>
        <EmptyTitle>{filtered ? '没有匹配的分享链接' : '还没有分享链接'}</EmptyTitle>
      </EmptyHeader>
      {filtered && <EmptyContent><Button variant="outline" onClick={resetFilters}>清空筛选</Button></EmptyContent>}
    </Empty>
  )
}
