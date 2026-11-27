import { Link2, Plus, SearchX } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { useShareFilterActions } from '../../hooks/use-share-filter-actions'
import useShareStore from '../../store'
import { CreateShareDialog } from '../create-dialog/deferred'

interface EmptyStateProps {
  filtered: boolean
}

export default function EmptyState({ filtered }: EmptyStateProps) {
  const { resetFilters } = useShareFilterActions()

  const hasResumes = useShareStore((state) => state.pageStats?.hasResumes)
  const open = useShareStore((state) => state.setCreateDialogOpen)

  return (
    <Empty className='min-h-80 rounded-none border-t border-border/60'>
      <EmptyHeader>
        <EmptyMedia variant='icon'>
          {filtered ? <SearchX /> : <Link2 />}
        </EmptyMedia>
        <EmptyTitle>
          {filtered ? '没有匹配的分享链接' : '还没有分享链接'}
        </EmptyTitle>
        {!filtered && (
          <EmptyDescription>
            {hasResumes !== false
              ? '为简历创建分享链接，向对方展示指定版本。'
              : '先创建或同步一份云端简历，再创建分享链接。'}
          </EmptyDescription>
        )}
      </EmptyHeader>
      <EmptyContent>
        {filtered ? (
          <Button variant='outline' onClick={resetFilters}>
            清空筛选
          </Button>
        ) : hasResumes !== false ? (
          <Button
            onPointerEnter={CreateShareDialog.preload}
            onFocus={CreateShareDialog.preload}
            onClick={() => open(true)}
          >
            <Plus data-icon='inline-start' />
            新建分享
          </Button>
        ) : (
          <Button asChild>
            <Link to='/resume'>前往我的简历</Link>
          </Button>
        )}
      </EmptyContent>
    </Empty>
  )
}
