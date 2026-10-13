import { Link2, SearchX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
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
        <EmptyDescription>
          {filtered ? '试试其他关键词，或清空筛选查看全部链接。' : '点击右上角「新建分享」，为简历创建链接并管理访问权限。'}
        </EmptyDescription>
      </EmptyHeader>
      {filtered && <EmptyContent><Button variant="outline" onClick={resetFilters}>清空筛选</Button></EmptyContent>}
    </Empty>
  )
}
