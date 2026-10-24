import { History as HistoryIcon, RefreshCcw } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Link } from 'react-router-dom'
import { PageLayout } from '@/components/layout/page-layout'
import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { DURATION, EASE } from '@/lib/motion'
import HistoryHeader from './components/header'
import HistoryWorkspace from './components/workspace'
import { useActiveHistoryResumeId } from './hooks/use-active-resume-id'
import { useHistoryMotion } from './hooks/use-history-motion'
import './motion.css'

function History() {
  const { activeResumeId, resumeOptions, loading, error, reload, selectResume } = useActiveHistoryResumeId()
  const reduceMotion = useReducedMotion()
  const { surfaceProps } = useHistoryMotion()

  return (
    <PageLayout workspace {...surfaceProps}>
      <HistoryHeader activeResumeId={activeResumeId} resumeOptions={resumeOptions} loading={loading} error={error} onResumeChange={selectResume} />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          className="flex min-h-0 min-w-0 flex-1 flex-col"
          key={activeResumeId ?? (loading ? 'loading' : 'empty')}
          initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: reduceMotion ? 0 : DURATION.fast } }}
          transition={{ duration: reduceMotion ? 0 : DURATION.base, ease: EASE.out }}
        >
          {!activeResumeId && loading
            ? (
                <div role="status" aria-label="正在加载历史版本" className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] gap-3 @min-[900px]/workspace:grid-cols-[clamp(16rem,23%,20rem)_minmax(0,1fr)]">
                  <Skeleton className={`h-full min-h-0 rounded-xl ${reduceMotion ? 'animate-none' : ''}`} />
                  <Skeleton className={`hidden h-full min-h-0 rounded-xl @min-[900px]/workspace:block ${reduceMotion ? 'animate-none' : ''}`} />
                </div>
              )
            : !activeResumeId
                ? (
                    <Empty className="min-h-0 flex-1 overflow-y-auto rounded-xl border bg-muted/10">
                      <EmptyHeader>
                        <EmptyMedia variant="icon"><HistoryIcon /></EmptyMedia>
                        <EmptyTitle>{error ? '简历列表暂时不可用' : resumeOptions.length > 0 ? '请选择一份简历' : '暂无云端简历'}</EmptyTitle>
                        {(error || resumeOptions.length === 0) && (
                          <EmptyDescription>{error || '版本记录仅支持云端简历，请先创建或同步简历。'}</EmptyDescription>
                        )}
                      </EmptyHeader>
                      {(error || resumeOptions.length === 0) && (
                        <EmptyContent>
                          {error
                            ? (
                                <Button variant="outline" onClick={reload}>
                                  <RefreshCcw data-icon="inline-start" />
                                  重新加载
                                </Button>
                              )
                            : <Button asChild><Link to="/resume">前往我的简历</Link></Button>}
                        </EmptyContent>
                      )}
                    </Empty>
                  )
                : <HistoryWorkspace activeResumeId={activeResumeId} onReloadResumeOptions={reload} />}
        </motion.div>
      </AnimatePresence>
    </PageLayout>
  )
}

export default History
