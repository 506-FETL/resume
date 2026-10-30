import type { LucideIcon } from 'lucide-react'
import type { DashboardAction, DashboardActionTone } from '../../insights'
import {
  AlertCircle,
  ArrowRight,
  CircleCheckBig,
  FilePlus2,
  FileSearch,
  ListChecks,
  LogIn,
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
      <div className='flex items-center gap-2 rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground'>
        <CircleCheckBig className='size-4 shrink-0' aria-hidden />
        <span>{message}</span>
      </div>
    )
  }

  return (
    <Card className='gap-0 overflow-hidden rounded-lg py-5 shadow-none'>
      <TodoHeader />
      <CardContent className='px-5 pt-0'>
        <AnimatedContent
          animationKey={
            unavailable
              ? 'unavailable'
              : loading
                ? 'loading'
                : !isAuthenticated
                  ? 'guest'
                  : !hasCloudResume
                    ? 'no-resume'
                    : actions.length === 0
                      ? 'empty'
                      : 'ready'
          }
        >
          {unavailable ? (
            <EmptyState
              icon={AlertCircle}
              title='— 待办数据暂不可用'
              hint='请重试失败的数据源。'
            />
          ) : loading ? (
            <TodoSkeleton />
          ) : !isAuthenticated ? (
            <EmptyState icon={LogIn} title='登录后查看今日待办' />
          ) : !hasCloudResume ? (
            <EmptyState
              icon={FilePlus2}
              title='还没有云端简历'
              hint='创建简历或将本地简历同步到云端后，可查看待办。'
            />
          ) : actions.length === 0 ? (
            <EmptyState
              icon={CircleCheckBig}
              title='待办已完成'
              tone='positive'
            />
          ) : (
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
            </div>
          )}
        </AnimatedContent>
      </CardContent>
    </Card>
  )
}

function EmptyState({
  icon: Icon,
  title,
  hint,
  tone = 'muted',
}: {
  icon: LucideIcon
  title: string
  hint?: string
  tone?: 'muted' | 'positive'
}) {
  return (
    <div className='flex flex-wrap items-center gap-2 text-left'>
      <div
        className={cn(
          'flex size-7 items-center justify-center rounded-full',
          tone === 'positive'
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            : 'bg-muted text-muted-foreground',
        )}
      >
        <Icon className='size-5' />
      </div>
      <p className='text-sm font-medium'>{title}</p>
      {hint && <p className='max-w-xs text-xs text-muted-foreground'>{hint}</p>}
    </div>
  )
}
