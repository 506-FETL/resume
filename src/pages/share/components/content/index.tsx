import { RefreshCcw } from 'lucide-react'
import { useMemo } from 'react'
import AnimatedContent from '@/components/motion/animated-content'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { ShareContentSkeleton } from '@/components/page-skeletons/share'
import useShareStore from '../../store'
import { filterShares } from '../../utils'
import EmptyState from '../empty-state'
import Grid from '../grid'

export default function Content() {
  const {
    allShares,
    pageLoading,
    pageError,
    searchKeyword,
    resumeFilters,
    statusFilter,
    reloadPage,
  } = useShareStore()

  const filteredShares = useMemo(
    () =>
      filterShares(allShares, {
        keyword: searchKeyword,
        resumeIds: resumeFilters,
        status: statusFilter,
      }),
    [allShares, resumeFilters, searchKeyword, statusFilter],
  )

  const hasFilter =
    Boolean(searchKeyword.trim()) ||
    resumeFilters.length > 0 ||
    statusFilter !== 'all'

  const contentState =
    allShares.length === 0 && pageLoading
      ? 'loading'
      : allShares.length === 0 && pageError
        ? 'error'
        : filteredShares.length === 0
          ? 'empty'
          : 'content'

  return (
    <AnimatedContent animationKey={contentState}>
      {contentState === 'loading' ? (
        <ShareContentSkeleton />
      ) : contentState === 'error' ? (
        <Empty className='min-h-80 border-t border-border/60 rounded-none'>
          <EmptyHeader>
            <EmptyMedia variant='icon'>
              <RefreshCcw />
            </EmptyMedia>
            <EmptyTitle>分享链接暂时不可用</EmptyTitle>
            <EmptyDescription>{pageError}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant='outline' onClick={() => reloadPage()}>
              <RefreshCcw data-icon='inline-start' />
              重试
            </Button>
          </EmptyContent>
        </Empty>
      ) : contentState === 'empty' ? (
        <EmptyState filtered={hasFilter} />
      ) : (
        <Grid shares={filteredShares} />
      )}
    </AnimatedContent>
  )
}
