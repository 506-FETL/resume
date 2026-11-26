import { JobContextBar } from '@/components/job-context/bar'
import { History as HistoryIcon, RefreshCcw } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { Link } from 'react-router-dom'
import { useEffect } from 'react'
import { PageLayout } from '@/components/layout/page-layout'
import { PresenceDiv } from '@/components/motion/presence-item'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { HistoryWorkspaceSkeleton } from '@/components/page-skeletons/history'
import { DURATION, EASE } from '@/lib/motion'
import HistoryHeader from './components/header'
import { createDeferredComponent } from '@/components/deferred-content'
import { useActiveHistoryResumeId } from './hooks/use-active-resume-id'
import { useHistoryMotion } from './hooks/use-history-motion'
import { historyComponent } from './utils/load-component'
import useHistoryStore from './store'
import './motion.css'

const HistoryWorkspace = createDeferredComponent(
  historyComponent(() => import('./components/workspace'), 'HistoryWorkspace'),
  '历史版本工作区',
  <HistoryWorkspaceSkeleton />,
  { wrapFallback: false },
)

function History() {
  useEffect(() => () => useHistoryStore.getState().resetJobOptions(), [])

  const { activeResumeId, hasOptions, loading, error, reload } =
    useActiveHistoryResumeId()

  const waitingForContent = useHistoryStore(
    (state) =>
      !activeResumeId || state.currentResume?.resumeId !== activeResumeId,
  )

  const reduceMotion = useReducedMotion()
  const { surfaceProps } = useHistoryMotion()

  return (
    <PageLayout
      workspace
      {...surfaceProps}
      className={`${surfaceProps.className} min-h-0 overflow-hidden [@media(max-height:500px)]:gap-1 [@media(max-height:500px)]:py-1`}
    >
      <div className='shrink-0 empty:hidden [@media(max-height:500px)]:[&>div]:flex-nowrap'>
        <JobContextBar />
      </div>
      <HistoryHeader activeResumeId={activeResumeId} />

      <AnimatePresence mode='wait' initial={false}>
        <PresenceDiv
          className='flex min-h-0 min-w-0 flex-1 flex-col'
          key={activeResumeId ?? (loading ? 'loading' : 'empty')}
          initial={
            waitingForContent ? false : { opacity: 0, y: reduceMotion ? 0 : 8 }
          }
          animate={{ opacity: 1, y: 0 }}
          exit={{
            opacity: waitingForContent ? 1 : 0,
            transition: {
              duration: reduceMotion || waitingForContent ? 0 : DURATION.fast,
            },
          }}
          transition={{
            duration: reduceMotion ? 0 : DURATION.base,
            ease: EASE.out,
          }}
        >
          {!activeResumeId && loading ? (
            <HistoryWorkspaceSkeleton />
          ) : !activeResumeId ? (
            <Empty className='min-h-0 flex-1 overflow-y-auto rounded-xl border bg-muted/10'>
              <EmptyHeader>
                <EmptyMedia variant='icon'>
                  <HistoryIcon />
                </EmptyMedia>
                <EmptyTitle>
                  {error
                    ? '简历列表暂时不可用'
                    : hasOptions
                      ? '请选择一份简历'
                      : '暂无云端简历'}
                </EmptyTitle>
                {(error || !hasOptions) && (
                  <EmptyDescription>
                    {error || '版本记录仅支持云端简历，请先创建或同步简历。'}
                  </EmptyDescription>
                )}
              </EmptyHeader>
              {(error || !hasOptions) && (
                <EmptyContent>
                  {error ? (
                    <Button variant='outline' onClick={reload}>
                      <RefreshCcw data-icon='inline-start' />
                      重新加载
                    </Button>
                  ) : (
                    <Button asChild>
                      <Link to='/resume'>前往我的简历</Link>
                    </Button>
                  )}
                </EmptyContent>
              )}
            </Empty>
          ) : (
            <HistoryWorkspace activeResumeId={activeResumeId} />
          )}
        </PresenceDiv>
      </AnimatePresence>
    </PageLayout>
  )
}

export default History
