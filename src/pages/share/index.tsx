import { LoaderCircle, RefreshCcw } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import DeleteDialog from './components/delete-dialog'
import EmptyState from './components/empty-state'
import Grid from './components/grid'
import Header from './components/header'
import MobileList from './components/mobile-list'
import SettingsDialog from './components/settings-dialog'
import Toolbar from './components/toolbar'
import { useSharePageBootstrap } from './hooks/use-share-page-bootstrap'
import useShareStore from './store'
import { filterShares } from './utils'

export default function Management() {
  useSharePageBootstrap()
  const reduceMotion = useReducedMotion()
  const { allShares, pageLoading, error, searchKeyword, resumeFilters, statusFilter, reloadPage } = useShareStore()

  const filteredShares = useMemo(
    () => filterShares(allShares, {
      keyword: searchKeyword,
      resumeIds: resumeFilters,
      status: statusFilter,
    }),
    [allShares, resumeFilters, searchKeyword, statusFilter],
  )
  const hasFilter = Boolean(searchKeyword.trim()) || resumeFilters.length > 0 || statusFilter !== 'all'

  if (pageLoading && allShares.length === 0) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center text-muted-foreground">
        <LoaderCircle className="mr-2 size-4 animate-spin" />
        正在加载分享链接…
      </div>
    )
  }

  if (error && allShares.length === 0) {
    return (
      <div className="mx-auto w-full max-w-7xl p-4 md:p-8">
        <Empty className="min-h-[420px] border border-dashed bg-muted/20">
          <EmptyHeader>
            <EmptyMedia variant="icon"><RefreshCcw /></EmptyMedia>
            <EmptyTitle>分享链接暂时不可用</EmptyTitle>
            <EmptyDescription>{error}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" onClick={() => reloadPage()}>
              <RefreshCcw data-icon="inline-start" />
              重试
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    )
  }

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 md:p-8"
    >
      <Header />
      <Toolbar />

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

      <SettingsDialog />
      <DeleteDialog />
    </motion.div>
  )
}
