import { useDerivedTasks } from './use-derived-tasks'
import { CircleAlert, GitBranch } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION, EASE } from '@/lib/motion'
import { Spinner } from '@/components/ui/spinner'
import { ContentSkeleton } from '@/components/loading-skeleton'
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

export interface DerivedJobsDialogProps {
  open: boolean
  onOpenChange: (next: boolean) => void
}

export function DerivedJobsDialog({
  open,
  onOpenChange,
}: DerivedJobsDialogProps) {
  const {
    resumes,
    loading,
    loadError,
    loadPending,
    runningTabRef,
    pendingId,
    runningItems,
    failed,
    tasks,
    discardRunning,
    handleFailedTask,
    openDeriveFor,
  } = useDerivedTasks(open, onOpenChange)

  const reduceMotion = useReducedMotion()

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
            resumes.length === 0 && runningItems.length === 0 ? (
              <ContentSkeleton
                label='正在读取任务'
                className='mt-4 px-0'
                rows={2}
              />
            ) : (
              <p role='status' className='mt-4 text-sm text-muted-foreground'>
                正在更新任务…
              </p>
            )
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
