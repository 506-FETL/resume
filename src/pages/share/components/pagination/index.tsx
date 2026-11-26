import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { SHARE_PAGE_SIZE } from '@/lib/supabase/resume/share/management'
import useShareStore from '../../store'

export default function SharePagination() {
  const page = useShareStore((state) => state.pageNumber)

  const total = useShareStore(
    (state) => state.pageTotal ?? state.statusCounts?.[state.statusFilter],
  )

  const setPageNumber = useShareStore((state) => state.setPageNumber)
  const statusRef = useRef<HTMLSpanElement>(null)

  const pages =
    total === undefined ? null : Math.max(1, Math.ceil(total / SHARE_PAGE_SIZE))

  if (pages === 1 || (pages === null && page === 1)) return null

  const change = (number: number) => {
    statusRef.current?.focus({ preventScroll: true })
    document.getElementById('share-management-results')?.scrollTo({ top: 0 })
    setPageNumber(number)
  }

  return (
    <nav
      aria-label='分享链接分页'
      className='flex shrink-0 items-center justify-end gap-2 border-t pt-2'
    >
      <span
        ref={statusRef}
        tabIndex={-1}
        role='status'
        className='mr-1 text-xs text-muted-foreground tabular-nums'
      >
        {pages
          ? `第 ${page} / ${pages} 页 · 共 ${total} 个分享`
          : `第 ${page} 页`}
      </span>
      <Button
        variant='outline'
        size='icon-sm'
        aria-label='上一页分享'
        disabled={page <= 1}
        onClick={() => change(page - 1)}
      >
        <ChevronLeft />
      </Button>
      <Button
        variant='outline'
        size='icon-sm'
        aria-label='下一页分享'
        disabled={pages === null || page >= pages}
        onClick={() => change(page + 1)}
      >
        <ChevronRight />
      </Button>
    </nav>
  )
}
