import type { LucideIcon } from 'lucide-react'
import type { DashboardAction, DashboardActionTone } from '../../insights'
import {
  AlertCircle,
  ArrowRight,
  CircleCheckBig,
  FileSearch,
  ListChecks,
  Send,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { AnimatedContent } from '@/components/motion/animated-content'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { TodoSkeleton } from '../skeleton'
import { TodoHeader } from './todo-header'

interface TodoCardProps {
  actions: DashboardAction[]
  loading: boolean
  isAuthenticated: boolean
  hasCloudResume: boolean
  unavailable?: boolean
}

const TONE_STYLES: Record<
  DashboardActionTone,
  { icon: LucideIcon; box: string; count: string }
> = {
  urgent: {
    icon: AlertCircle,
    box: 'bg-red-500/10 text-red-600 dark:text-red-400',
    count: 'text-red-600 dark:text-red-400',
  },
  warning: {
    icon: ListChecks,
    box: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
    count: 'text-amber-600 dark:text-amber-500',
  },
  info: {
    icon: Send,
    box: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    count: 'text-blue-600 dark:text-blue-400',
  },
  muted: {
    icon: FileSearch,
    box: 'bg-muted text-muted-foreground',
    count: 'text-foreground',
  },
}

export function TodoCard({
  actions,
  loading,
  isAuthenticated,
  hasCloudResume,
  unavailable,
}: TodoCardProps) {
  if (!loading && !unavailable && actions.length === 0) {
    const message = !isAuthenticated
      ? '登录后查看今日待办'
      : !hasCloudResume
        ? '创建云端简历后可查看优化待办'
        : '今日待办已完成'

    return (
      <div className='flex h-full items-start gap-2 rounded-t-lg border-x border-t border-foreground/10 bg-transparent px-4 py-3 text-sm text-muted-foreground'>
        <CircleCheckBig className='mt-0.5 size-4 shrink-0' aria-hidden />
        <span>{message}</span>
      </div>
    )
  }

  return (
    <Card className='h-full gap-0 overflow-hidden rounded-t-lg rounded-b-none border-x border-t border-foreground/10 bg-transparent py-5 shadow-none ring-0'>
      <TodoHeader />
      <CardContent className='relative px-5 pt-0'>
        <AnimatedContent
          mode='popLayout'
          animationKey={
            actions.length ? 'ready' : unavailable ? 'error' : 'loading'
          }
        >
          {actions.length > 0 ? (
            <div className='flex flex-col gap-1'>
              {actions.map((action) => {
                const tone = TONE_STYLES[action.tone]
                const Icon = tone.icon

                return (
                  <Button
                    key={action.id}
                    asChild
                    variant='ghost'
                    className='group h-auto w-full justify-start gap-3 rounded-lg px-3 py-3 text-left whitespace-normal motion-reduce:transition-none'
                  >
                    <Link to={action.to}>
                      <div
                        className={cn(
                          'flex size-9 shrink-0 items-center justify-center rounded-lg',
                          tone.box,
                        )}
                      >
                        <Icon className='size-[18px]' />
                      </div>
                      <div className='min-w-0 flex-1'>
                        <p className='text-sm font-medium'>
                          <span
                            className={cn(
                              'mr-1 text-base font-semibold tabular-nums',
                              tone.count,
                            )}
                          >
                            {action.count}
                          </span>
                          {action.label}
                        </p>
                        {action.hint && (
                          <p className='mt-0.5 text-xs leading-5 text-muted-foreground'>
                            {action.hint}
                          </p>
                        )}
                      </div>
                      <ArrowRight className='size-4 shrink-0 text-muted-foreground/50 group-hover:text-foreground' />
                    </Link>
                  </Button>
                )
              })}
              {(unavailable || loading) && (
                <p role='status' className='mt-2 text-xs text-muted-foreground'>
                  {unavailable ? '部分待办暂不可用' : '其余待办正在加载'}
                </p>
              )}
            </div>
          ) : unavailable ? (
            <p className='flex items-center gap-2 text-sm text-muted-foreground'>
              <AlertCircle className='size-4' aria-hidden />
              部分待办未能加载
            </p>
          ) : (
            <TodoSkeleton />
          )}
        </AnimatedContent>
      </CardContent>
    </Card>
  )
}
