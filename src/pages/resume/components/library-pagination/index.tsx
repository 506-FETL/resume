import { Button } from '@/components/ui/button'
import { RESUME_LIBRARY_PAGE_SIZE } from '@/lib/supabase/resume/library'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { MouseEvent, RefObject } from 'react'
import useResumeListStore from '../../store'

export function LibraryPagination({
  loading,
  pageCount,
  pageStatusRef,
  changePage,
}: {
  loading: boolean
  pageCount: number | null
  pageStatusRef: RefObject<HTMLSpanElement | null>
  changePage: (event: MouseEvent<HTMLButtonElement>, page: number) => void
}) {
  const libraryPage = useResumeListStore((state) => state.libraryPage)
  const libraryTotal = useResumeListStore((state) => state.libraryTotal)
  const libraryQuery = useResumeListStore((state) => state.libraryQuery)

  const hasNextPage = useResumeListStore((state) => state.libraryHasNextPage)

  const countsLoading = useResumeListStore(
    (state) => state.libraryCountsLoading,
  )

  const searchCountError = useResumeListStore(
    (state) => state.librarySearchCountError,
  )

  const loadLibraryPage = useResumeListStore((state) => state.loadLibraryPage)

  return (
    <footer className='shrink-0 border-t bg-background pt-3 pb-[env(safe-area-inset-bottom)] [@media(max-height:500px)]:pt-1'>
      <nav
        aria-label='简历分页'
        className='flex min-w-0 flex-wrap items-center justify-end gap-2'
      >
        <span
          ref={pageStatusRef}
          tabIndex={-1}
          role='status'
          aria-live='polite'
          className='mr-1 min-w-40 text-xs whitespace-nowrap text-muted-foreground tabular-nums'
        >
          {pageCount !== null && libraryPage <= pageCount
            ? `第 ${libraryPage} / ${pageCount} 页 · ${libraryQuery ? `匹配 ${libraryTotal} 份` : `每页 ${RESUME_LIBRARY_PAGE_SIZE} 份`}`
            : loading || (libraryQuery ? !searchCountError : countsLoading)
              ? `每页 ${RESUME_LIBRARY_PAGE_SIZE} 份`
              : `第 ${libraryPage} 页 · 总页数暂不可用`}
        </span>
        {searchCountError && (
          <Button
            variant='ghost'
            size='sm'
            onClick={() => loadLibraryPage(libraryPage)}
          >
            重试匹配数量
          </Button>
        )}
        <Button
          variant='outline'
          size='icon-sm'
          aria-label='上一页简历'
          disabled={loading || libraryPage <= 1}
          onClick={(event) => changePage(event, libraryPage - 1)}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant='outline'
          size='icon-sm'
          aria-label='下一页简历'
          disabled={
            loading ||
            (pageCount === null ? !hasNextPage : libraryPage >= pageCount)
          }
          onClick={(event) => changePage(event, libraryPage + 1)}
        >
          <ChevronRight />
        </Button>
      </nav>
    </footer>
  )
}
