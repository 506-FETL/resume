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
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { ResumeItem } from './resume-item'
import { useResumeManager } from './use-resume-manager'

export function ResumeManager() {
  const {
    loading,
    loadError,
    retry,
    open,
    setOpen,
    selectedResumeName,
    selectedResumeId,
    onlineResumes,
    offlineResumes,
    ButtonIcon,
    iconColorClass,
    handleSelect,
    resumes,
  } = useResumeManager()

  const reduceMotion = useReducedMotion()
  const initialLoading = loading && resumes.length === 0

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant='outline' size='sm' disabled={initialLoading}>
          {initialLoading ? (
            <Spinner />
          ) : (
            <ButtonIcon className={cn(iconColorClass)} />
          )}
          <span className='truncate text-xs'>
            {initialLoading ? '加载中...' : selectedResumeName}
          </span>
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
              resumes.length
                ? 'resumes'
                : initialLoading
                  ? 'loading'
                  : loadError
                    ? 'error'
                    : 'empty'
            }
          >
            {initialLoading ? (
              <div
                className='flex min-h-48 flex-col items-center justify-center gap-3 text-muted-foreground'
                role='status'
              >
                <Spinner className='size-8' />
                <p className='text-sm'>正在加载简历列表...</p>
              </div>
            ) : (
              <div className='space-y-4'>
                <AnimatedContent animationKey={loadError ? 'error' : 'ready'}>
                  {loadError && (
                    <div
                      role='alert'
                      className='flex items-center justify-between gap-3 text-sm text-muted-foreground'
                    >
                      <p>
                        {resumes.length
                          ? '部分简历加载失败，已显示可用简历。'
                          : '简历列表加载失败，请重试。'}
                      </p>
                      <Button
                        size='sm'
                        variant='outline'
                        disabled={loading}
                        onClick={() => {
                          retry()
                        }}
                      >
                        重试
                      </Button>
                    </div>
                  )}
                </AnimatedContent>
                {[
                  { label: '云端简历', items: onlineResumes },
                  { label: '本地简历', items: offlineResumes },
                ].map(({ label, items }) =>
                  items.length > 0 ? (
                    <div key={label} className='space-y-2'>
                      <p className='text-xs font-medium text-muted-foreground'>
                        {label}
                      </p>
                      {items.map((resume) => (
                        <ResumeItem
                          key={resume.id}
                          resume={resume}
                          isSelected={selectedResumeId === resume.resume_id}
                          onSelect={() => handleSelect(resume)}
                        />
                      ))}
                    </div>
                  ) : null,
                )}
                {resumes.length === 0 && !loadError && (
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
