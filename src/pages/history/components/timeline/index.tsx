import type { HistorySelection } from '../../types'
import { History, SearchX } from 'lucide-react'
import { AnimatePresence, LayoutGroup, motion } from 'motion/react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { PresenceDiv } from '@/components/motion/presence-item'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { staggerDelay } from '@/lib/motion'
import {
  DEFAULT_VERSION_FILTER,
  type VersionFilterCriteria,
  isFilterActive,
} from '../../filter'
import { useHistoryMotion } from '../../hooks/use-history-motion'
import useHistoryStore from '../../store'
import { groupVersionsByDay } from '../../utils'
import HistoryMotionContent from '../motion-content'
import HistoryLoadError from '../shared/history-load-error'
import CurrentVersionCard from './current-version-card'
import TimelineEmptyState from './empty-state'
import TimelineLoadingState from './loading-state'
import VersionCard from './version-card'
import TimelinePagination from './pagination'
import VersionFilterBar from './version-filter-bar'

interface HistoryTimelineProps {
  selectedEntry: HistorySelection
  onSelectEntry: (target: HistorySelection) => void
}

export default function HistoryTimeline({
  selectedEntry,
  onSelectEntry,
}: HistoryTimelineProps) {
  const resumeId = useHistoryStore((state) => state.resumeId)
  const currentResume = useHistoryStore((state) => state.currentResume)

  const currentResumeError = useHistoryStore(
    (state) => state.currentResumeError,
  )

  const currentResumeLoading = useHistoryStore(
    (state) => state.currentResumeLoading,
  )

  const timelineVersions = useHistoryStore((state) => state.timelineVersions)
  const versionTotal = useHistoryStore((state) => state.versionTotal)
  const matchingVersions = useHistoryStore((state) => state.matchingVersions)
  const versionFilter = useHistoryStore((state) => state.versionFilter)
  const showVersionPage = useHistoryStore((state) => state.showVersionPage)
  const versionsLoaded = useHistoryStore((state) => state.versionsLoaded)
  const versionsLoading = useHistoryStore((state) => state.versionsLoading)
  const versionsError = useHistoryStore((state) => state.versionsError)

  const reloadCurrentResume = useHistoryStore(
    (state) => state.reloadCurrentResume,
  )

  const reloadVersions = useHistoryStore((state) => state.reloadVersions)

  const currentPending = !currentResume && !currentResumeError
  const versionsPending = !versionsLoaded && !versionsError
  const [filter, setFilter] = useState(DEFAULT_VERSION_FILTER)
  const { reduceMotion, enter, exit, layout } = useHistoryMotion()
  const layoutId = useId()

  const scrollRef = useRef<HTMLDivElement>(null)

  const keywordTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )

  useEffect(() => {
    setFilter(DEFAULT_VERSION_FILTER)

    return () => clearTimeout(keywordTimerRef.current)
  }, [resumeId])

  function changeFilter(next: VersionFilterCriteria) {
    clearTimeout(keywordTimerRef.current)
    setFilter(next)

    const apply = () => {
      scrollRef.current?.scrollTo({ top: 0 })
      showVersionPage(next, 0)
    }

    if (next.keyword && next.keyword !== filter.keyword)
      keywordTimerRef.current = setTimeout(apply, 200)
    else apply()
  }

  const groups = useMemo(
    () => groupVersionsByDay(timelineVersions),
    [timelineVersions],
  )

  const hasFilter =
    versionFilter.keyword.trim().length > 0 || isFilterActive(versionFilter)

  const itemMotion = {
    initial: { opacity: 0, y: reduceMotion ? 0 : 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: reduceMotion ? 0 : -4, transition: exit },
    transition: { ...enter, layout },
  }

  return (
    <LayoutGroup id={layoutId}>
      <Card className='flex min-h-0 min-w-0 flex-1 flex-col gap-0 overflow-hidden rounded-none border-0 border-border/70 bg-transparent py-0 shadow-none ring-0 @min-[900px]/workspace:border-r'>
        <div className='flex shrink-0 items-center justify-between gap-3 px-4 pb-2 pt-3'>
          <h2 className='flex items-center gap-2 text-sm font-semibold'>
            <History className='size-4 text-muted-foreground' />
            版本记录
          </h2>
          <span className='text-xs tabular-nums text-muted-foreground'>
            {versionTotal === null && !versionsError ? (
              <Skeleton className='h-3 w-14' />
            ) : versionTotal !== null ? (
              `${versionTotal} 个版本`
            ) : (
              '—'
            )}
          </span>
        </div>

        <div className='shrink-0 px-2 pb-1'>
          <HistoryMotionContent
            transitionKey={currentPending ? 'loading' : 'current'}
          >
            {currentPending ? (
              <TimelineLoadingState count={1} />
            ) : (
              <CurrentVersionCard
                selected={selectedEntry === 'current'}
                onSelectEntry={onSelectEntry}
              />
            )}
          </HistoryMotionContent>
          <HistoryLoadError
            error={currentResumeError}
            retry={reloadCurrentResume}
            loading={currentResumeLoading}
          />
        </div>

        <AnimatePresence initial={false}>
          {(Boolean(versionTotal) || hasFilter) && (
            <PresenceDiv
              key='filter'
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0, transition: exit }}
              transition={enter}
              className='shrink-0 overflow-hidden'
            >
              <div className='px-3 py-2'>
                <VersionFilterBar criteria={filter} onChange={changeFilter} />
                <AnimatePresence initial={false}>
                  {hasFilter && (
                    <PresenceDiv
                      key='result-count'
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0, transition: exit }}
                      transition={enter}
                      className='overflow-hidden'
                    >
                      <p
                        aria-live='polite'
                        className='px-1 pt-2 text-xs text-muted-foreground'
                      >
                        {matchingVersions !== null
                          ? `找到 ${matchingVersions} 个版本，共 ${versionTotal} 个`
                          : versionsError
                            ? '筛选结果暂不可用'
                            : '正在查找版本…'}
                      </p>
                    </PresenceDiv>
                  )}
                </AnimatePresence>
              </div>
            </PresenceDiv>
          )}
        </AnimatePresence>

        <PresenceDiv
          ref={scrollRef}
          layoutScroll
          className='scrollbar-thin-subtle min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3 pt-1'
        >
          <HistoryLoadError
            error={versionsError}
            retry={reloadVersions}
            loading={versionsLoading}
          />
          <PresenceDiv
            layout={reduceMotion ? false : 'size'}
            transition={layout}
            className='relative flex flex-col gap-1'
          >
            <AnimatePresence initial={false} mode='popLayout'>
              {versionsPending ? (
                <PresenceDiv key='loading' {...itemMotion}>
                  <TimelineLoadingState />
                </PresenceDiv>
              ) : groups.length > 0 ? (
                groups.flatMap((group) => [
                  <motion.h3
                    key={`day-${group.label}`}
                    layout={reduceMotion ? false : 'position'}
                    {...itemMotion}
                    className='px-2.5 pb-1 pt-3 text-xs font-medium text-muted-foreground first:pt-1'
                  >
                    {group.label}
                  </motion.h3>,
                  ...group.items.map((version, index) => (
                    <PresenceDiv
                      key={version.id}
                      layout={reduceMotion ? false : 'position'}
                      {...itemMotion}
                      transition={{
                        ...enter,
                        delay: reduceMotion
                          ? 0
                          : staggerDelay(Math.min(index, 5)),
                        layout,
                      }}
                    >
                      <VersionCard
                        version={version}
                        selected={selectedEntry === version.id}
                        onSelectEntry={onSelectEntry}
                      />
                    </PresenceDiv>
                  )),
                ])
              ) : versionsLoaded ? (
                <PresenceDiv
                  key={hasFilter ? 'no-results' : 'empty'}
                  {...itemMotion}
                >
                  {hasFilter ? (
                    <div className='flex flex-col items-center gap-3 px-3 py-8 text-center'>
                      <SearchX className='size-6 text-muted-foreground/60' />
                      <p className='text-sm text-muted-foreground'>
                        没有符合条件的版本
                      </p>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => changeFilter(DEFAULT_VERSION_FILTER)}
                      >
                        清除筛选
                      </Button>
                    </div>
                  ) : (
                    <TimelineEmptyState currentResume={currentResume} />
                  )}
                </PresenceDiv>
              ) : null}
            </AnimatePresence>
          </PresenceDiv>
        </PresenceDiv>
        <TimelinePagination
          onNavigate={() => scrollRef.current?.scrollTo({ top: 0 })}
        />
      </Card>
    </LayoutGroup>
  )
}
