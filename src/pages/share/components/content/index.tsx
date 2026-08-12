import { RefreshCcw } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'
import useShareStore from '../../store'
import { filterShares } from '../../utils'
import EmptyState from '../empty-state'
import Grid from '../grid'
import MobileList from '../mobile-list'

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

  if (pageLoading && allShares.length === 0) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center gap-2 text-muted-foreground">
        <Spinner />
        正在加载分享链接…
      </div>
    )
  }

  if (pageError && allShares.length === 0) {
    return (
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
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {filteredShares.length === 0
        ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <EmptyState filtered={hasFilter} />
            </motion.div>
          )
        : (
            <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Grid shares={filteredShares} />
              <MobileList shares={filteredShares} />
            </motion.div>
          )}
    </AnimatePresence>
  )
}
