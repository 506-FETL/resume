import { LoaderCircle } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import AnimatedContent from '@/components/motion/animated-content'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useResumeTemplateStore } from '@/store/resume-template'
import {
  TEMPLATE_LOAD_MORE_DISTANCE,
  TEMPLATE_LOAD_MORE_ROOT_MARGIN,
} from '../../const'
import { useTemplateIntersection } from '../../hooks/use-template-intersection'
import { useTemplatePageStore } from '../../store'
import { templateScrollRoot } from '../../utils'

export default function CatalogFooter() {
  const reduceMotion = useReducedMotion()

  const {
    catalog,
    catalogQuery,
    nextOffset,
    loadingMore,
    loadMoreError,
    loadMore,
  } = useResumeTemplateStore(
    useShallow((state) => ({
      catalog: state.catalog,
      catalogQuery: state.catalogQuery,
      nextOffset: state.nextOffset,
      loadingMore: state.loadingMore,
      loadMoreError: state.loadMoreError,
      loadMore: state.loadMore,
    })),
  )

  // 每次追加后重新观察新位置，快速连续滚动时也不会沿用上一批的相交状态。
  const { ref, inRange } = useTemplateIntersection(
    TEMPLATE_LOAD_MORE_ROOT_MARGIN,
    false,
    nextOffset,
  )

  const { styleFilter, layoutFilter } = useTemplatePageStore(
    useShallow((state) => ({
      styleFilter: state.styleFilter,
      layoutFilter: state.layoutFilter,
    })),
  )

  const matchesFilter =
    (catalogQuery.style || null) === styleFilter &&
    (catalogQuery.layout || null) === layoutFilter

  useEffect(() => {
    if (
      !inRange ||
      !matchesFilter ||
      catalog.status !== 'ready' ||
      nextOffset === null ||
      loadingMore ||
      loadMoreError ||
      !ref.current
    )
      return

    // 追加后的 observer 通知可能尚未到达；复查实际位置，防止旧 inRange 连续拉完整个目录。
    const bounds = ref.current.getBoundingClientRect()
    const root = templateScrollRoot(ref.current)?.getBoundingClientRect()

    if (
      bounds.top <=
        (root?.bottom ?? window.innerHeight) + TEMPLATE_LOAD_MORE_DISTANCE &&
      bounds.bottom >= (root?.top ?? 0)
    )
      loadMore()
  }, [
    inRange,
    matchesFilter,
    catalog.status,
    nextOffset,
    loadingMore,
    loadMoreError,
    loadMore,
    ref,
  ])

  const status = loadMoreError
    ? 'error'
    : loadingMore
      ? 'loading'
      : nextOffset === null
        ? 'end'
        : 'more'

  return (
    <div
      ref={ref}
      data-template-feed-footer
      data-state={status}
      className='min-h-16 py-4 text-center'
    >
      <AnimatedContent animationKey={status}>
        {status === 'end' ? (
          <p role='status' className='text-xs text-muted-foreground'>
            已展示全部
            <Badge variant='outline' className='mx-1'>
              {catalog.status === 'ready' ? catalog.data.length : 0}
            </Badge>
            套模板
          </p>
        ) : (
          <div className='flex flex-col items-center gap-2'>
            {loadMoreError && (
              <p role='alert' className='text-sm text-destructive'>
                后续模板加载失败，请重试
              </p>
            )}
            <Button
              variant='outline'
              disabled={loadingMore || !matchesFilter}
              onClick={loadMore}
            >
              {loadingMore && (
                <LoaderCircle
                  aria-hidden
                  className={cn('size-4', !reduceMotion && 'animate-spin')}
                />
              )}
              {loadingMore
                ? '正在加载更多模板…'
                : loadMoreError
                  ? '重试加载更多'
                  : '加载更多模板'}
            </Button>
          </div>
        )}
      </AnimatedContent>
    </div>
  )
}
