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
import { Skeleton } from '@/components/ui/skeleton'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { cn } from '@/lib/utils'
import {
  SHARE_GRID_CLASS,
  SHARE_GROUP_CLASS,
  SHARE_GROUP_HEADER_CLASS,
} from '../../const'
import useShareStore from '../../store'
import { filterShares } from '../../utils'
import EmptyState from '../empty-state'
import Grid from '../grid'

export default function Content() {
  const reduceMotion = useReducedMotion()

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
        <div
          role='status'
          aria-label='正在加载分享链接'
          className={cn(
            SHARE_GRID_CLASS,
            reduceMotion && '[&_[data-slot=skeleton]]:animate-none',
          )}
        >
          {[2, 1].map((linkCount) => (
            <div
              key={linkCount}
              aria-hidden='true'
              className={SHARE_GROUP_CLASS}
            >
              <div className={SHARE_GROUP_HEADER_CLASS}>
                <Skeleton className='size-10 shrink-0 rounded-xl' />
                <div className='min-w-0 flex-1'>
                  <Skeleton className='h-6 w-32 max-w-full sm:h-7.5' />
                  <Skeleton className='mt-1.5 h-4 w-20' />
                </div>
              </div>
              <div className='@container/share-links min-w-0'>
                {Array.from({ length: linkCount }, (_, linkIndex) => (
                  <div
                    key={linkIndex}
                    className='grid min-w-0 gap-4 border-b border-border/60 px-3 py-5 last:border-b-0 sm:px-4 @min-[600px]/share-links:grid-cols-[minmax(0,1fr)_auto] @min-[600px]/share-links:gap-6'
                  >
                    <div className='min-w-0'>
                      <div className='flex min-h-5 items-center gap-2'>
                        <Skeleton className='size-4 shrink-0 rounded-sm' />
                        <Skeleton className='h-4 w-24' />
                        <Skeleton className='ml-auto h-3 w-8' />
                      </div>
                      <div className='mt-3 flex flex-wrap gap-2'>
                        <Skeleton className='h-4 w-28' />
                        <Skeleton className='h-4 w-36' />
                      </div>
                    </div>
                    <div className='flex min-w-0 flex-col justify-center gap-3 @min-[600px]/share-links:w-56'>
                      <Skeleton className='h-4 w-40 @min-[600px]/share-links:self-end' />
                      <div className='flex gap-1.5'>
                        <Skeleton className='h-9 flex-1 rounded-md' />
                        <Skeleton className='h-9 w-20 rounded-md' />
                        <Skeleton className='size-9 rounded-md' />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
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
