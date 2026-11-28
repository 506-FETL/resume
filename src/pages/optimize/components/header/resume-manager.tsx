import { ChevronDown, FileText } from 'lucide-react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { Link } from 'react-router-dom'
import AnimatedContent from '@/components/motion/animated-content'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { LoadingStatus } from '@/components/loading-status'
import { cn } from '@/lib/utils'
import useAtsStore from '../../store'
import { ResumeItem } from './resume-item'
import { useResumeManager } from './use-resume-manager'

export function ResumeManager() {
  const {
    pages,
    authReady,
    loadMore,
    userId,
    open,
    setOpen,
    selectedResumeName,
    selectedResumeId,
    ButtonIcon,
    iconColorClass,
    handleSelect,
  } = useResumeManager()

  const scoresLoading = useAtsStore((s) => s.optionScoresLoading)
  const retryScores = useAtsStore((s) => s.retryOptionScores)
  const reduceMotion = useReducedMotion()

  const groups = [
    { source: 'online', label: '云端简历', page: pages.online },
    { source: 'offline', label: '本地简历', page: pages.offline },
  ] as const

  const empty = groups.every(({ page }) => page.ready && !page.items.length)

  const initialLoading =
    !authReady ||
    (groups.every(({ page }) => !page.items.length && !page.error) && !empty)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant='outline' size='sm' aria-busy={open && initialLoading}>
          <ButtonIcon className={cn(iconColorClass)} />
          <span className='truncate text-xs'>{selectedResumeName}</span>
          <ChevronDown className='shrink-0 opacity-50' />
        </Button>
      </DialogTrigger>
      <DialogContent
        className='max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] grid-rows-[auto_minmax(0,1fr)] sm:max-w-125'
        style={reduceMotion ? { animationDuration: '0s' } : undefined}
      >
        <DialogHeader>
          <DialogTitle>选择要优化的简历</DialogTitle>
          <DialogDescription>从已有简历中选择</DialogDescription>
        </DialogHeader>
        <ScrollArea className='-mx-2 min-h-0 max-h-[min(350px,55dvh)] px-2'>
          <AnimatedContent
            animationKey={
              initialLoading ? 'loading' : empty ? 'empty' : 'resumes'
            }
          >
            {initialLoading ? (
              <LoadingStatus label='正在加载简历列表' />
            ) : (
              <div className='space-y-4'>
                {groups.map(({ label, source, page }) => (
                  <div key={source} className='space-y-2 empty:hidden'>
                    <AnimatedContent
                      animationKey={
                        page.items.length > 0 || page.error ? 'list' : 'idle'
                      }
                      className='space-y-2 empty:hidden'
                    >
                      {(page.items.length > 0 || page.error) && (
                        <p className='text-xs font-medium text-muted-foreground'>
                          {label}
                        </p>
                      )}
                      {page.items.map((item) => (
                        <ResumeItem
                          key={item.resume_id}
                          resume={{
                            display_name: item.display_name || '未命名简历',
                            created_at: item.created_at,
                            isOffline: source === 'offline',
                            isScored:
                              item.report === undefined
                                ? null
                                : Boolean(item.report),
                            overall_score: item.report?.overall_score ?? null,
                          }}
                          isSelected={selectedResumeId === item.resume_id}
                          onSelect={() => handleSelect(item.resume_id, source)}
                        />
                      ))}
                    </AnimatedContent>
                    {page.loading && !page.items.length && (
                      <LoadingStatus label={`正在加载${label}`} />
                    )}
                    {(page.error || page.hasMore) && (
                      <div className='flex items-center justify-between gap-3 text-xs text-muted-foreground'>
                        {page.error && (
                          <span role='alert'>{label}加载失败，请重试。</span>
                        )}
                        <Button
                          variant='outline'
                          size='sm'
                          className='ml-auto'
                          disabled={page.loading}
                          aria-busy={page.loading}
                          onClick={() => loadMore(source)}
                        >
                          {page.error
                            ? '重试'
                            : page.loading
                              ? '正在加载'
                              : `加载更多${label}`}
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
                {userId &&
                  pages.online.items.some(
                    (item) => item.report === undefined,
                  ) && (
                    <div
                      role='alert'
                      className='flex items-center justify-between gap-3 text-sm text-muted-foreground'
                    >
                      <p>检测记录暂时不可用，仍可选择简历。</p>
                      <Button
                        size='sm'
                        variant='outline'
                        disabled={scoresLoading}
                        onClick={() => retryScores(userId)}
                      >
                        重试检测记录
                      </Button>
                    </div>
                  )}
                {empty && (
                  <div className='flex min-h-48 flex-col items-center justify-center gap-3 text-muted-foreground'>
                    <FileText className='size-9 opacity-50' aria-hidden />
                    <p className='text-sm'>
                      还没有简历，先去“我的简历”创建一份。
                    </p>
                    <Button
                      asChild
                      variant='outline'
                      onClick={() => setOpen(false)}
                    >
                      <Link to='/resume'>前往我的简历</Link>
                    </Button>
                  </div>
                )}
              </div>
            )}
          </AnimatedContent>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
