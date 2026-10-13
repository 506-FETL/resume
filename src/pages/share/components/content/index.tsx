import { RefreshCcw } from 'lucide-react'
import { useMemo } from 'react'
import AnimatedContent from '@/components/motion/animated-content'
import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { SHARE_GRID_CLASS } from '../../const'
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
    () => filterShares(allShares, {
      keyword: searchKeyword,
      resumeIds: resumeFilters,
      status: statusFilter,
    }),
    [allShares, resumeFilters, searchKeyword, statusFilter],
  )
  const hasFilter = Boolean(searchKeyword.trim())
    || resumeFilters.length > 0
    || statusFilter !== 'all'

  const contentState = allShares.length === 0 && pageLoading
    ? 'loading'
    : allShares.length === 0 && pageError
      ? 'error'
      : filteredShares.length === 0 ? 'empty' : 'content'

  return (
    <AnimatedContent animationKey={contentState}>
      {contentState === 'loading'
        ? (
            <div role="status" aria-label="正在加载分享链接" className={SHARE_GRID_CLASS}>
              {[0, 1, 2].map(index => (
                <div key={index} aria-hidden="true" className="min-w-0 space-y-3 rounded-xl border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <Skeleton className="size-9 rounded-lg" />
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-9 w-full rounded-lg" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ))}
            </div>
          )
        : contentState === 'error'
          ? (
              <Empty className="min-h-105 border border-dashed bg-muted/20">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><RefreshCcw /></EmptyMedia>
                  <EmptyTitle>分享链接暂时不可用</EmptyTitle>
                  <EmptyDescription>{pageError}</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button variant="outline" onClick={() => reloadPage()}>
                    <RefreshCcw data-icon="inline-start" />
                    重试
                  </Button>
                </EmptyContent>
              </Empty>
            )
          : contentState === 'empty'
            ? (
                <EmptyState filtered={hasFilter} />
              )
            : (
                <Grid shares={filteredShares} />
              )}
    </AnimatedContent>
  )
}
