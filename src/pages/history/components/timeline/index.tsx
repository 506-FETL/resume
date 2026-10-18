import type { HistorySelection } from '../../types'
import { History, SearchX } from 'lucide-react'
import { AnimatePresence, LayoutGroup, motion } from 'motion/react'
import { useEffect, useId, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { staggerDelay } from '@/lib/motion'
import { DEFAULT_VERSION_FILTER, filterVersions, isFilterActive } from '../../filter'
import { useHistoryMotion } from '../../hooks/use-history-motion'
import useHistoryStore from '../../store'
import { groupVersionsByDay } from '../../utils'
import HistoryMotionContent from '../motion-content'
import CurrentVersionCard from './current-version-card'
import TimelineEmptyState from './empty-state'
import TimelineLoadingState from './loading-state'
import VersionCard from './version-card'
import VersionFilterBar from './version-filter-bar'

interface HistoryTimelineProps {
  selectedEntry: HistorySelection
  onSelectEntry: (target: HistorySelection) => void
}

export default function HistoryTimeline({ selectedEntry, onSelectEntry }: HistoryTimelineProps) {
  const { resumeId, currentResume, versions, loading } = useHistoryStore()
  const [filter, setFilter] = useState(DEFAULT_VERSION_FILTER)
  const { reduceMotion, enter, exit, layout } = useHistoryMotion()
  const layoutId = useId()

  useEffect(() => {
    setFilter(DEFAULT_VERSION_FILTER)
  }, [resumeId])

  const filteredVersions = useMemo(() => filterVersions(versions, filter), [versions, filter])
  const groups = groupVersionsByDay(filteredVersions)
  const hasFilter = filter.keyword.trim().length > 0 || isFilterActive(filter)
  const itemMotion = {
    initial: { opacity: 0, y: reduceMotion ? 0 : 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: reduceMotion ? 0 : -4, transition: exit },
    transition: { ...enter, layout },
  }

  return (
    <LayoutGroup id={layoutId}>
      <Card className="flex min-h-0 min-w-0 flex-col gap-0 overflow-hidden rounded-xl border-border/70 py-0 shadow-none">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3.5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <History className="size-4 text-muted-foreground" />
            版本记录
          </h2>
          <Badge variant="secondary" className="text-xs font-normal">{loading ? '加载中…' : `${versions.length} 个版本`}</Badge>
        </div>

        <div className="shrink-0 border-b p-3">
          <HistoryMotionContent transitionKey={loading && !currentResume ? 'loading' : 'current'}>
            {loading && !currentResume
              ? <TimelineLoadingState count={1} />
              : <CurrentVersionCard selected={selectedEntry === 'current'} onSelectEntry={onSelectEntry} />}
          </HistoryMotionContent>
        </div>

        <AnimatePresence initial={false}>
          {!loading && versions.length > 0 && (
            <motion.div
              key="filter"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0, transition: exit }}
              transition={enter}
              className="shrink-0 overflow-hidden border-b"
            >
              <div className="px-3 py-3">
                <VersionFilterBar criteria={filter} onChange={setFilter} />
                <AnimatePresence initial={false}>
                  {hasFilter && (
                    <motion.div
                      key="result-count"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0, transition: exit }}
                      transition={enter}
                      className="overflow-hidden"
                    >
                      <p aria-live="polite" className="px-1 pt-2 text-xs text-muted-foreground">
                        找到
                        {' '}
                        {filteredVersions.length}
                        {' '}
                        个版本，共
                        {' '}
                        {versions.length}
                        {' '}
                        个
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div layoutScroll className="scrollbar-thin-subtle min-h-32 max-h-[max(240px,calc(100dvh-30rem))] overflow-y-auto overscroll-contain p-3">
          <motion.div layout={reduceMotion ? false : 'size'} transition={layout} className="relative flex flex-col gap-2">
            <AnimatePresence initial={false} mode="popLayout">
              {loading
                ? <motion.div key="loading" {...itemMotion}><TimelineLoadingState /></motion.div>
                : groups.length > 0
                  ? groups.flatMap(group => [
                      <motion.h3 key={`day-${group.label}`} layout={reduceMotion ? false : 'position'} {...itemMotion} className="px-1 pb-1 pt-2 text-xs font-medium text-muted-foreground">{group.label}</motion.h3>,
                      ...group.items.map((version, index) => (
                        <motion.div
                          key={version.id}
                          layout={reduceMotion ? false : 'position'}
                          {...itemMotion}
                          transition={{ ...enter, delay: reduceMotion ? 0 : staggerDelay(Math.min(index, 5)), layout }}
                        >
                          <VersionCard version={version} selected={selectedEntry === version.id} onSelectEntry={onSelectEntry} />
                        </motion.div>
                      )),
                    ])
                  : (
                      <motion.div key={versions.length > 0 ? 'no-results' : 'empty'} {...itemMotion}>
                        {versions.length > 0
                          ? (
                              <div className="flex flex-col items-center gap-3 px-3 py-8 text-center">
                                <SearchX className="size-6 text-muted-foreground/60" />
                                <p className="text-sm text-muted-foreground">没有符合条件的版本</p>
                                <Button variant="outline" size="sm" onClick={() => setFilter(DEFAULT_VERSION_FILTER)}>清除筛选</Button>
                              </div>
                            )
                          : <TimelineEmptyState currentResume={currentResume} />}
                      </motion.div>
                    )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      </Card>
    </LayoutGroup>
  )
}
