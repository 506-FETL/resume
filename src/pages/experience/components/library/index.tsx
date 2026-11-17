import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { AnimatePresence } from 'motion/react'
import { FileStack, Upload } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-layout'
import { PresenceDiv } from '@/components/motion/presence-item'
import { ExperienceRowsSkeleton } from '@/components/page-skeletons/experience'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  EmptyMedia,
} from '@/components/ui/empty'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { CONTENT_SWITCH, DURATION, EASE } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { EXPERIENCE_DESCRIPTION, EXPERIENCE_GRID_CLASS } from '../../const'
import { useExperienceList } from '../../hooks/use-experience-list'
import { useExperiencePageStore } from '../../store'
import LibraryToolbar from '../library-toolbar'
import LibrarySelection from '../library-selection'
import DeleteSourcesDialog from '../delete-sources-dialog'
import SourceItem from '../source-item'

export default function ExperienceLibrary({
  scrollRef,
}: {
  scrollRef: RefObject<HTMLDivElement | null>
}) {
  const {
    query,
    filter,
    offset,
    view,
    selectionMode,
    selectedSources,
    deleting,
    setSelectionMode,
    setOffset,
    openUpload,
    setListScroll,
    select,
  } = useExperiencePageStore()

  const { page, error, loading, retry } = useExperienceList()
  const reduced = useReducedMotion()

  const snapshotRef = useRef<{
    page: NonNullable<typeof page>
    offset: number
  } | null>(null)

  const focusPageRef = useRef(false)
  const visitedSourcesRef = useRef(new Set<string>())

  if (page) snapshotRef.current = { page, offset }

  const displayed = page ? { page, offset } : snapshotRef.current
  const items = displayed?.page.items ?? []
  const filtered = !!query.trim() || filter !== 'all'
  const unresolved = !page && (loading || !!error)

  const empty =
    !items.length && !error && !loading && !deleting && !selectedSources.length

  useEffect(() => {
    focusPageRef.current = false
  }, [query, filter])

  useEffect(() => {
    if (error) focusPageRef.current = false
    if (!page || loading || error) return
    if (page.items.length === 0 && offset > 0) {
      setOffset(Math.max(0, Math.floor((page.total - 1) / 10) * 10))

      return
    }
    if (focusPageRef.current) {
      focusPageRef.current = false

      if (scrollRef.current) scrollRef.current.scrollTop = 0

      scrollRef.current
        ?.querySelector<HTMLButtonElement>('[data-source-id]')
        ?.focus({ preventScroll: true })
    }
  }, [page, loading, error, offset, setOffset, scrollRef])

  useEffect(() => {
    page?.items.forEach((source) => visitedSourcesRef.current.add(source.id))
  }, [page])

  function clearFilters() {
    document
      .querySelector<HTMLButtonElement>('[data-experience-all]')
      ?.focus({ preventScroll: true })

    useExperiencePageStore.setState({
      query: '',
      filter: 'all',
      offset: 0,
      selectedSources: [],
    })
  }

  function changePage(nextOffset: number) {
    focusPageRef.current = true

    if (nextOffset === offset) retry()
    else setOffset(nextOffset)
  }

  return (
    <div className='flex min-h-0 min-w-0 flex-1 flex-col gap-5'>
      <div className='shrink-0'>
        <PageHeader
          title='职业档案'
          description={EXPERIENCE_DESCRIPTION}
          actions={
            <>
              <Button
                variant='outline'
                disabled={deleting}
                onClick={() => openUpload('paste')}
              >
                粘贴文字
              </Button>
              <Button
                data-experience-upload
                disabled={deleting}
                onClick={() => openUpload('files')}
              >
                <Upload />
                上传资料
              </Button>
            </>
          }
        />
      </div>
      <LibraryToolbar />
      <div className='shrink-0'>
        <div className='flex min-h-8 items-center justify-between gap-3 text-xs text-muted-foreground'>
          <p aria-live='polite'>
            {error
              ? displayed
                ? `上次读取到 ${displayed.page.total} 份资料`
                : '资料数量暂不可用'
              : page
                ? `共 ${page.total} 份资料`
                : displayed
                  ? '正在更新资料'
                  : '正在读取资料'}
          </p>
          <div className='flex items-center gap-3'>
            <p className='hidden @min-[400px]/workspace:block'>最近更新</p>
            <Button
              variant='ghost'
              size='sm'
              data-experience-selection
              aria-pressed={selectionMode}
              disabled={
                deleting || (!selectionMode && (!items.length || unresolved))
              }
              onClick={() => setSelectionMode(!selectionMode)}
            >
              {selectionMode ? '退出选择' : '批量选择'}
            </Button>
          </div>
        </div>
        <LibrarySelection sources={items} disabled={unresolved || loading} />
      </div>
      {error && (
        <div
          role='alert'
          className='flex shrink-0 flex-wrap items-center gap-3 text-sm'
        >
          <p className='min-w-0 flex-1 text-destructive'>
            {error}
            {displayed && !page ? ' 下面保留上次读取的结果。' : ''}
          </p>
          <Button variant='outline' size='sm' onClick={retry}>
            重新读取
          </Button>
        </div>
      )}
      <div
        ref={scrollRef}
        data-experience-library-scroll
        aria-busy={loading || deleting}
        className='relative min-h-0 flex-1 overflow-y-auto px-0.5 py-0.5'
      >
        {!displayed && loading ? (
          <ExperienceRowsSkeleton view={view} />
        ) : (
          <AnimatePresence mode='wait' initial={false}>
            {empty ? (
              <PresenceDiv
                key='empty'
                initial={{ opacity: 0, y: reduced ? 0 : 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{
                  opacity: 0,
                  transition: {
                    ...CONTENT_SWITCH.exit,
                    duration: reduced ? 0 : CONTENT_SWITCH.exit.duration,
                  },
                }}
                transition={{
                  ...CONTENT_SWITCH.enter,
                  duration: reduced ? 0 : CONTENT_SWITCH.enter.duration,
                }}
              >
                <Empty className='min-h-64 py-10'>
                  <EmptyHeader>
                    <EmptyMedia variant='icon'>
                      <FileStack />
                    </EmptyMedia>
                    <EmptyTitle>
                      {filtered ? '没有找到符合条件的资料' : '还没有职业档案'}
                    </EmptyTitle>
                    <EmptyDescription>
                      {filtered
                        ? '换个名称搜索，或清除筛选查看全部资料。'
                        : '上传职业背景、工作经历或项目资料，也可以直接粘贴文字。'}
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent className='flex-row flex-wrap justify-center'>
                    {filtered ? (
                      <Button variant='outline' onClick={clearFilters}>
                        清除筛选
                      </Button>
                    ) : (
                      <>
                        <Button onClick={() => openUpload('files')}>
                          <Upload />
                          上传资料
                        </Button>
                        <Button
                          variant='outline'
                          onClick={() => openUpload('paste')}
                        >
                          粘贴文字
                        </Button>
                      </>
                    )}
                  </EmptyContent>
                </Empty>
              </PresenceDiv>
            ) : (
              <PresenceDiv
                key={view}
                data-experience-view={view}
                className={cn(
                  'relative',
                  view === 'grid'
                    ? EXPERIENCE_GRID_CLASS
                    : 'flex flex-col gap-1',
                )}
                initial={{ opacity: 0, y: reduced ? 0 : 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{
                  opacity: 0,
                  transition: {
                    ...CONTENT_SWITCH.exit,
                    duration: reduced ? 0 : CONTENT_SWITCH.exit.duration,
                  },
                }}
                transition={{
                  ...CONTENT_SWITCH.enter,
                  duration: reduced ? 0 : CONTENT_SWITCH.enter.duration,
                }}
              >
                <AnimatePresence mode='popLayout'>
                  {items.map((source, index) => (
                    <PresenceDiv
                      key={source.id}
                      className='min-w-0'
                      layout={reduced ? false : 'position'}
                      initial={
                        visitedSourcesRef.current.has(source.id) || index > 5
                          ? false
                          : { opacity: 0, y: reduced ? 0 : 8 }
                      }
                      animate={{ opacity: 1, y: 0 }}
                      exit={{
                        opacity: 0,
                        transition: {
                          duration: reduced ? 0 : DURATION.fast,
                          ease: EASE.in,
                          delay: 0,
                        },
                      }}
                      transition={{
                        duration: reduced ? 0 : DURATION.base,
                        ease: EASE.out,
                        delay: reduced || index > 5 ? 0 : index * 0.03,
                      }}
                    >
                      <SourceItem
                        source={source}
                        view={view}
                        disabled={unresolved || deleting}
                        onOpen={() => {
                          setListScroll(scrollRef.current?.scrollTop ?? 0)
                          select(source.id)
                        }}
                      />
                    </PresenceDiv>
                  ))}
                </AnimatePresence>
              </PresenceDiv>
            )}
          </AnimatePresence>
        )}
      </div>
      {displayed && (displayed.page.total > 10 || displayed.offset > 0) && (
        <footer className='flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground'>
          <p>
            第 {Math.floor(displayed.offset / 10) + 1} 页 ·{' '}
            {displayed.offset + 1}–
            {displayed.offset + displayed.page.items.length} /{' '}
            {displayed.page.total}
          </p>
          <div className='flex gap-1'>
            <Button
              size='sm'
              variant='ghost'
              disabled={loading || deleting || displayed.offset === 0}
              onClick={() => changePage(Math.max(0, displayed.offset - 10))}
            >
              上一页
            </Button>
            <Button
              size='sm'
              variant='ghost'
              disabled={loading || deleting || !displayed.page.hasMore}
              onClick={() => changePage(displayed.offset + 10)}
            >
              下一页
            </Button>
          </div>
        </footer>
      )}
      <DeleteSourcesDialog />
    </div>
  )
}
