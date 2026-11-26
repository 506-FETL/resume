import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { HISTORY_PAGE_SIZE } from '@/lib/supabase/resume/history/queries/timeline'
import useHistoryStore from '../../store'

export default function TimelinePagination({
  onNavigate,
}: {
  onNavigate: () => void
}) {
  const page = useHistoryStore((state) => state.versionPage)
  const total = useHistoryStore((state) => state.matchingVersions)
  const statusRef = useRef<HTMLSpanElement>(null)

  const pages =
    total === null ? null : Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE))

  if (page === 0 && (pages === null || pages <= 1)) return null

  function navigate(next: number) {
    const { versionFilter, showVersionPage } = useHistoryStore.getState()

    statusRef.current?.focus({ preventScroll: true })
    onNavigate()
    showVersionPage(versionFilter, next)
  }

  return (
    <nav
      aria-label='历史版本分页'
      className='flex shrink-0 items-center justify-end gap-2 border-t border-border/70 px-3 py-2'
    >
      <span
        ref={statusRef}
        tabIndex={-1}
        role='status'
        className='mr-auto text-xs tabular-nums text-muted-foreground'
      >
        {pages ? `第 ${page + 1} / ${pages} 页` : `第 ${page + 1} 页`}
      </span>
      <Button
        aria-label='上一页'
        variant='outline'
        size='icon-sm'
        disabled={page === 0}
        onClick={() => navigate(page - 1)}
      >
        <ChevronLeft />
      </Button>
      <Button
        aria-label='下一页'
        variant='outline'
        size='icon-sm'
        disabled={pages === null || page + 1 >= pages}
        onClick={() => navigate(page + 1)}
      >
        <ChevronRight />
      </Button>
    </nav>
  )
}
