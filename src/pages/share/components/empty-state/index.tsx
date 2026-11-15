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

  const { resumeMap, resumeOptionsLoaded, resumeOptionsError } = useShareStore()
  const canCreate = Object.keys(resumeMap).length > 0

  const [createOpen, setCreateOpen] = useState(false)

  return (
    <>
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
              {!resumeOptionsLoaded
                ? resumeOptionsError
                  ? '简历列表暂时不可用，请重试后创建分享。'
                  : '简历列表正在加载，完成后可以创建分享。'
                : canCreate
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
          ) : resumeOptionsLoaded ? (
            <Button asChild>
              <Link to='/resume'>前往我的简历</Link>
            </Button>
          ) : null}
        </EmptyContent>
      </Empty>
      <CreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  )
}
