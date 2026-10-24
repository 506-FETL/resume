import { Link2, Plus, SearchX } from 'lucide-react'
import { useState } from 'react'
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
import CreateDialog from '../create-dialog'

interface EmptyStateProps {
  filtered: boolean
}

export default function EmptyState({ filtered }: EmptyStateProps) {
  const { resetFilters } = useShareFilterActions()
  const canCreate = useShareStore(
    (state) => Object.keys(state.resumeMap).length > 0,
  )
  const [createOpen, setCreateOpen] = useState(false)
  return (
    <>
      <Empty className='min-h-80 rounded-2xl border border-dashed bg-muted/15'>
        <EmptyHeader>
          <EmptyMedia variant='icon'>
            {filtered ? <SearchX /> : <Link2 />}
          </EmptyMedia>
          <EmptyTitle>
            {filtered ? '没有匹配的分享链接' : '还没有分享链接'}
          </EmptyTitle>
          {!filtered && (
            <EmptyDescription>
              {canCreate
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
          ) : canCreate ? (
            <Button onClick={() => setCreateOpen(true)}>
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
      <CreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  )
}
