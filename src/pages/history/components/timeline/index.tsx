import type { HistorySelection } from '../../types'
import { LoaderCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { formatRelativeTime } from '@/utils/date'
import { DEFAULT_VERSION_FILTER, filterVersions, isFilterActive } from '../../filter'
import { useOverflowState } from '../../hooks/use-overflow-state'
import useHistoryStore from '../../store'
import { groupVersionsByDay } from '../../utils'
import CurrentVersionCard from './current-version-card'
import TimelineEmptyState from './empty-state'
import TimelineLoadingState from './loading-state'
import VersionCard from './version-card'
import VersionFilterBar from './version-filter-bar'

interface HistoryTimelineProps {
  selectedEntry: HistorySelection
  onSelectEntry: (target: HistorySelection) => void
}

export default function HistoryTimeline({
  selectedEntry,
  onSelectEntry,
}: HistoryTimelineProps) {
  const { resumeId, currentResume, versions, loading } = useHistoryStore()
  const { ref: scrollRef, overflowing } = useOverflowState<HTMLDivElement>()
  const [filter, setFilter] = useState(DEFAULT_VERSION_FILTER)

  // 切换简历时重置筛选，避免上一份简历的条件带过来
  useEffect(() => {
    setFilter(DEFAULT_VERSION_FILTER)
  }, [resumeId])

  const filteredVersions = useMemo(() => filterVersions(versions, filter), [versions, filter])
  const groups = groupVersionsByDay(filteredVersions)
  const hasKeywordOrFilter = filter.keyword.trim().length > 0 || isFilterActive(filter)
  const timelineCountLabel = versions.length === 0
    ? '暂无版本记录'
    : hasKeywordOrFilter
      ? `筛选出 ${filteredVersions.length} / 共 ${versions.length} 条`
      : `${versions.length} 条版本记录`

  return (
    <Card className="flex min-h-0 flex-col gap-0 overflow-hidden border-border/70 bg-background/95 py-0 shadow-none max-h-[72dvh] md:max-h-[min(78vh,920px)] lg:sticky lg:top-20 lg:h-[calc(100vh-7rem)] lg:max-h-230">
      <CardHeader className="gap-4 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{timelineCountLabel}</Badge>
          {loading && (
            <Badge variant="secondary">
              <LoaderCircle data-icon="inline-start" className="animate-spin" />
              正在加载
            </Badge>
          )}
          {currentResume?.updatedAt && (
            <Badge variant="outline">
              当前内容更新于
              {' '}
              {formatRelativeTime(currentResume.updatedAt)}
            </Badge>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <CardTitle>版本时间线</CardTitle>
          <CardDescription>
            {loading ? '正在加载这份简历的版本记录。' : '左侧选择版本，右侧查看内容、编辑说明或恢复版本。'}
          </CardDescription>
        </div>
      </CardHeader>
      <Separator />

      <CardContent
        ref={scrollRef}
        className={cn(
          'min-h-0 flex-1 px-0 py-0',
          overflowing
            ? 'scrollbar-gutter-stable scrollbar-thin-subtle overflow-y-auto overscroll-contain'
            : 'overflow-hidden',
        )}
      >
        <div className="flex flex-col gap-4 p-4 sm:p-5">
          <section className="flex flex-col gap-2.5">
            <div className="px-1 text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
              当前版本
            </div>
            <CurrentVersionCard
              selected={selectedEntry === 'current'}
              onSelectEntry={onSelectEntry}
            />
          </section>

          <Separator />

          <section className="flex flex-col gap-3.5">
            {!loading && versions.length > 0 && (
              <VersionFilterBar criteria={filter} onChange={setFilter} />
            )}

            {loading
              ? (
                  <TimelineLoadingState />
                )
              : groups.length > 0
                ? (
                    <div className="flex flex-col gap-5">
                      {groups.map(group => (
                        <section key={group.label} className="flex flex-col gap-3">
                          <div className="flex items-center gap-2.5">
                            <Separator className="flex-1" />
                            <span className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                              {group.label}
                            </span>
                            <Separator className="flex-1" />
                          </div>

                          <div className="flex flex-col gap-2 border-l border-dashed border-border/70 pl-5">
                            {group.items.map((version, index) => (
                              <VersionCard
                                key={version.id}
                                version={version}
                                index={index}
                                selected={selectedEntry === version.id}
                                onSelectEntry={onSelectEntry}
                              />
                            ))}
                          </div>
                        </section>
                      ))}
                    </div>
                  )
                : versions.length > 0
                  ? (
                      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-muted/20 px-3 py-10 text-center">
                        <p className="text-sm text-muted-foreground">没有符合条件的版本</p>
                        <Button variant="outline" size="sm" className="h-8" onClick={() => setFilter(DEFAULT_VERSION_FILTER)}>
                          清除筛选
                        </Button>
                      </div>
                    )
                  : (
                      <TimelineEmptyState currentResume={currentResume} />
                    )}
          </section>
        </div>
      </CardContent>
    </Card>
  )
}
