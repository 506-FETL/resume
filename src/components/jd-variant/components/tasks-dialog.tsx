import { CircleAlert, GitBranch } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { toast } from 'sonner'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION, EASE } from '@/lib/motion'
import { Spinner } from '@/components/ui/spinner'
import { AnimatedContent } from '@/components/motion/animated-content'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  deleteOfflineDraftVariant,
  isOfflineResumeId,
} from '@/lib/offline-resume-manager'
import { deleteDraftVariant } from '@/lib/supabase/resume/variant'
import useResumeListStore from '@/pages/resume/store'
import useJdVariantStore from '@/store/jd-variant'

export interface DerivedJobsDialogProps {
  open: boolean
  onOpenChange: (next: boolean) => void
}

type RunningItem =
  | { parentResumeId: string; parentName: string; source: 'store' }
  | {
      parentResumeId: string
      parentName: string
      source: 'db'
      dbResumeId: string
    }

export function DerivedJobsDialog({
  open,
  onOpenChange,
}: DerivedJobsDialogProps) {
  const list = useResumeListStore()
  const { openDeriveFor } = list
  const resumes = list.libraryActive ? list.libraryPendingItems : list.resumes
  const loading = list.libraryActive ? list.libraryPendingLoading : list.loading

  const loadError = list.libraryActive
    ? list.libraryPendingError
    : list.loadError

  const loadPending = list.libraryActive
    ? list.loadLibraryPendingItems
    : list.loadResumes

  const loadResumes = list.libraryActive
    ? list.refreshLibrary
    : list.loadResumes

  useEffect(() => {
    if (open) loadPending()
  }, [open, loadPending])

  const tasks = useJdVariantStore((s) => s.tasks)
  const discardTask = useJdVariantStore((s) => s.discardTask)
  const runningTabRef = useRef<HTMLButtonElement>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const reduceMotion = useReducedMotion()

  const runningItems = useMemo<RunningItem[]>(() => {
    const resumeNameById = new Map(
      [
        ...Object.values(list.libraryActive ? list.libraryParents : {}),
        ...resumes,
      ]
        .filter((resume) => resume !== null)
        .map((resume) => [resume.resume_id, resume.display_name]),
    )

    const storeRunning: RunningItem[] = Object.values(tasks)
      .filter((t) => t.phase === 'parsing' || t.phase === 'rewriting')
      .map((t) => ({
        parentResumeId: t.parentResumeId,
        parentName: resumeNameById.get(t.parentResumeId) ?? '未命名简历',
        source: 'store',
      }))

    const storeParentIds = new Set(
      storeRunning.map((item) => item.parentResumeId),
    )

    const seen = new Set<string>()
    const dbRunning: RunningItem[] = []

    for (const r of resumes) {
      if (r.derived_status !== 'generating') continue

      const parentId = r.parent_resume_id ?? r.resume_id

      if (storeParentIds.has(r.parent_resume_id ?? '')) continue
      if (seen.has(parentId)) continue

      seen.add(parentId)

      dbRunning.push({
        parentResumeId: parentId,
        parentName:
          resumeNameById.get(r.parent_resume_id ?? '') ?? '未命名简历',
        source: 'db',
        dbResumeId: r.resume_id,
      })
    }

    return [...storeRunning, ...dbRunning]
  }, [tasks, resumes, list.libraryActive, list.libraryParents])

  const failed = useMemo(
    () => resumes.filter((r) => r.derived_status === 'failed'),
    [resumes],
  )

  const discard = async (id: string) => {
    if (isOfflineResumeId(id)) await deleteOfflineDraftVariant(id)
    else await deleteDraftVariant(id)
  }

  const discardRunning = async (item: RunningItem) => {
    if (pendingId) return

    setPendingId(item.parentResumeId)

    try {
      if (item.source === 'db') await discard(item.dbResumeId)
      else await discardTask(item.parentResumeId)

      await loadResumes()
      toast.success('已丢弃草稿')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '丢弃失败，请重试')
    } finally {
      setPendingId(null)
    }
  }

  const handleFailedTask = async (
    id: string,
    retryParentId?: string | null,
  ) => {
    if (pendingId) return

    setPendingId(id)

    try {
      await discard(id)
      await loadResumes()

      if (retryParentId) {
        openDeriveFor(retryParentId)
        onOpenChange(false)
      } else {
        toast.success('已丢弃草稿')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '操作失败，请重试')
    } finally {
      setPendingId(null)
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      contentClassName='h-[min(80dvh,40rem)] sm:max-w-xl'
    >
      <ResponsiveDialogContent className='min-h-0 overflow-hidden'>
        <ResponsiveDialogHeader className='shrink-0 border-b px-5 py-5 text-left sm:px-6'>
          <ResponsiveDialogTitle>派生任务</ResponsiveDialogTitle>
          <ResponsiveDialogDescription className='sr-only'>
            查看岗位版本的生成进度，重试失败任务或丢弃草稿。
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <AnimatedContent
          animationKey={loadError ? 'error' : loading ? 'loading' : 'ready'}
          className='shrink-0 px-5 sm:px-6'
        >
          {loadError ? (
            <Alert variant='destructive' className='mt-4'>
              <CircleAlert aria-hidden />
              <AlertTitle>未能读取全部任务</AlertTitle>
              <AlertDescription>
                <p>{loadError}</p>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => {
                    runningTabRef.current?.focus({ preventScroll: true })
                    loadPending(true)
                  }}
                >
                  重新加载
                </Button>
              </AlertDescription>
            </Alert>
          ) : loading ? (
            <p
              className='mt-4 flex items-center gap-2 text-sm text-muted-foreground'
              role='status'
            >
              <Spinner />
              正在读取任务…
            </p>
          ) : null}
        </AnimatedContent>

        <Tabs
          defaultValue='running'
          className='min-h-0 flex-1 gap-0 overflow-hidden'
        >
          <TabsList className='mx-5 mt-5 mb-2 grid w-auto shrink-0 grid-cols-2 sm:mx-6'>
            <TabsTrigger ref={runningTabRef} value='running'>
              生成中
              <Badge variant='secondary'>{runningItems.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value='failed'>
              失败
              <Badge variant='destructive'>
                {resumes.length === 0 && (loading || loadError)
                  ? '—'
                  : failed.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value='running'
            className='min-h-0 flex-1 overflow-hidden'
          >
            <ScrollArea className='h-full min-h-0 [&_[data-slot=scroll-area-viewport]]:overscroll-contain'>
              <div className='px-5 pb-5 sm:px-6'>
                <AnimatePresence mode='wait' initial={false}>
                  {runningItems.length === 0 ? (
                    !loading &&
                    !loadError && (
                      <motion.div
                        key='empty'
                        initial={{
                          opacity: 0,
                          transform: reduceMotion ? 'none' : 'translateY(8px)',
                        }}
                        animate={{ opacity: 1, transform: 'translateY(0px)' }}
                        exit={{ opacity: 0 }}
                        transition={{
                          duration: reduceMotion ? 0 : DURATION.fast,
                          ease: EASE.out,
                        }}
                      >
                        <Empty className='min-h-56'>
                          <EmptyHeader>
                            <EmptyMedia variant='icon'>
                              <GitBranch />
                            </EmptyMedia>
                            <EmptyTitle>暂无进行中的派生任务</EmptyTitle>
                          </EmptyHeader>
                        </Empty>
                      </motion.div>
                    )
                  ) : (
                    <motion.ul
                      key='tasks'
                      className='divide-y'
                      initial={{
                        opacity: 0,
                        transform: reduceMotion ? 'none' : 'translateY(8px)',
                      }}
                      animate={{ opacity: 1, transform: 'translateY(0px)' }}
                      exit={{ opacity: 0 }}
                      transition={{
                        duration: reduceMotion ? 0 : DURATION.fast,
                        ease: EASE.out,
                      }}
                    >
                      {runningItems.map((item) => (
                        <li
                          key={item.parentResumeId}
                          className='space-y-3 py-4'
                        >
                          <div className='flex items-start justify-between gap-3'>
                            <h3 className='min-w-0 text-sm font-medium wrap-anywhere'>
                              {item.parentName}
                            </h3>
                            <Badge variant='secondary' className='shrink-0'>
                              {item.source === 'db'
                                ? '进度未知'
                                : tasks[item.parentResumeId]?.phase ===
                                    'parsing'
                                  ? '解析中'
                                  : '改写中'}
                            </Badge>
                          </div>
                          <p className='text-sm leading-relaxed text-muted-foreground'>
                            {item.source === 'store'
                              ? '关闭窗口后仍会继续生成。'
                              : '页面刷新后无法恢复生成进度，可丢弃草稿后重新生成。'}
                          </p>
                          <div className='flex flex-wrap justify-end gap-2'>
                            {item.source === 'store' && (
                              <Button
                                size='sm'
                                variant='outline'
                                disabled={pendingId !== null}
                                onClick={() => {
                                  openDeriveFor(item.parentResumeId)
                                  onOpenChange(false)
                                }}
                              >
                                查看进度
                              </Button>
                            )}
                            <Button
                              size='sm'
                              variant='destructive'
                              disabled={pendingId !== null}
                              onClick={() => discardRunning(item)}
                            >
                              {pendingId === item.parentResumeId && <Spinner />}
                              丢弃
                            </Button>
                          </div>
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent
            value='failed'
            className='min-h-0 flex-1 overflow-hidden'
          >
            <ScrollArea className='h-full min-h-0 [&_[data-slot=scroll-area-viewport]]:overscroll-contain'>
              <div className='px-5 pb-5 sm:px-6'>
                <AnimatePresence mode='wait' initial={false}>
                  {failed.length === 0 ? (
                    !loading &&
                    !loadError && (
                      <motion.div
                        key='empty'
                        initial={{
                          opacity: 0,
                          transform: reduceMotion ? 'none' : 'translateY(8px)',
                        }}
                        animate={{ opacity: 1, transform: 'translateY(0px)' }}
                        exit={{ opacity: 0 }}
                        transition={{
                          duration: reduceMotion ? 0 : DURATION.fast,
                          ease: EASE.out,
                        }}
                      >
                        <Empty className='min-h-56'>
                          <EmptyHeader>
                            <EmptyMedia variant='icon'>
                              <CircleAlert />
                            </EmptyMedia>
                            <EmptyTitle>暂无失败任务</EmptyTitle>
                          </EmptyHeader>
                        </Empty>
                      </motion.div>
                    )
                  ) : (
                    <motion.ul
                      key='tasks'
                      className='divide-y'
                      initial={{
                        opacity: 0,
                        transform: reduceMotion ? 'none' : 'translateY(8px)',
                      }}
                      animate={{ opacity: 1, transform: 'translateY(0px)' }}
                      exit={{ opacity: 0 }}
                      transition={{
                        duration: reduceMotion ? 0 : DURATION.fast,
                        ease: EASE.out,
                      }}
                    >
                      {failed.map((item) => (
                        <li key={item.resume_id} className='space-y-3 py-4'>
                          <div className='flex items-start justify-between gap-3'>
                            <h3 className='min-w-0 text-sm font-medium wrap-anywhere'>
                              {item.display_name || '未命名草稿'}
                            </h3>
                            <Badge variant='destructive' className='shrink-0'>
                              失败
                            </Badge>
                          </div>
                          {item.linked_jd_text && (
                            <p className='line-clamp-3 text-sm leading-relaxed wrap-anywhere text-muted-foreground'>
                              职位描述：{item.linked_jd_text}
                            </p>
                          )}
                          <div className='flex flex-wrap justify-end gap-2'>
                            {pendingId === item.resume_id && (
                              <Spinner className='my-auto' />
                            )}
                            <Button
                              size='sm'
                              variant='outline'
                              disabled={
                                !item.parent_resume_id || pendingId !== null
                              }
                              onClick={() =>
                                handleFailedTask(
                                  item.resume_id,
                                  item.parent_resume_id,
                                )
                              }
                            >
                              重试
                            </Button>
                            <Button
                              size='sm'
                              variant='destructive'
                              disabled={pendingId !== null}
                              onClick={() => handleFailedTask(item.resume_id)}
                            >
                              丢弃
                            </Button>
                          </div>
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
