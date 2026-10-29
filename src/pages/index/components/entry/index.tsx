import type { MouseEventHandler, ReactNode } from 'react'
import type { TimelineEvent, TimelineEventType } from '../../insights'
import {
  ArrowRight,
  Clock,
  FileUser,
  FolderKanban,
  LayoutTemplate,
  PencilRuler,
  Plus,
  Send,
  Sparkles,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { AnimatedContent } from '@/components/motion/animated-content'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { cn } from '@/lib/utils'

function Entry({
  events,
  timelineLoading,
  resumeCount,
  onCreate,
  unavailable,
}: {
  events: TimelineEvent[]
  timelineLoading: boolean
  resumeCount?: number
  onCreate: MouseEventHandler<HTMLButtonElement>
  unavailable?: boolean
}) {
  const navigate = useNavigate()

  return (
    <div className='grid min-w-0 items-start gap-8 lg:grid-cols-2'>
      {/* 快捷操作 */}
      <Card className='flex min-w-0 flex-col gap-0 rounded-none border-0 border-t bg-transparent py-5 shadow-none ring-0'>
        <CardHeader className='px-0 pb-4'>
          <div className='flex items-center gap-2'>
            <div className='p-1.5 rounded-md bg-primary/8'>
              <Sparkles className='size-4 text-primary' />
            </div>
            <CardTitle className='text-base font-semibold'>快捷操作</CardTitle>
          </div>
        </CardHeader>
        <CardContent className='min-w-0 flex-1 px-0 pt-0'>
          <div className='grid grid-cols-2 gap-2.5'>
            <QuickAction
              title='创建简历'
              icon={<Plus className='size-4' />}
              onClick={onCreate}
              iconBg='bg-primary/10 text-primary'
              highlight
            />
            <QuickAction
              title='求职看板'
              icon={<FolderKanban className='size-4' />}
              onClick={() => navigate('/tracker')}
              iconBg='bg-blue-500/10 text-blue-500'
            />
            <QuickAction
              title='简历模板'
              icon={<LayoutTemplate className='size-4' />}
              onClick={() => navigate('/template')}
              iconBg='bg-violet-500/10 text-violet-500'
            />
            <QuickAction
              title='简历优化'
              icon={<PencilRuler className='size-4' />}
              onClick={() => navigate('/optimize')}
              iconBg='bg-emerald-500/10 text-emerald-500'
            />
          </div>
        </CardContent>
      </Card>

      {/* 最近动态 */}
      <Card className='flex min-w-0 flex-col gap-0 rounded-none border-0 border-t bg-transparent py-5 shadow-none ring-0'>
        <CardHeader className='px-0 pb-4'>
          <div className='flex items-center gap-2'>
            <div className='p-1.5 rounded-md bg-primary/8'>
              <Clock className='size-4 text-primary' />
            </div>
            <CardTitle className='text-base font-semibold'>最近动态</CardTitle>
          </div>
        </CardHeader>
        <CardContent className='min-w-0 flex-1 px-0 pt-0'>
          <AnimatedContent
            animationKey={
              events.length > 0
                ? 'ready'
                : timelineLoading
                  ? 'loading'
                  : 'empty'
            }
          >
            {events.length > 0 ? (
              <div className='flex flex-col gap-3'>
                {unavailable && (
                  <p role='status' className='text-xs text-muted-foreground'>
                    部分动态暂不可用，请重试失败的数据源。
                  </p>
                )}
                <ol className='flex flex-col'>
                  {events.map((event, index) => (
                    <TimelineItem
                      key={event.id}
                      event={event}
                      isLast={index === events.length - 1}
                      onClick={() => navigate(event.to)}
                    />
                  ))}
                </ol>
                <div className='pt-3 border-t flex items-center justify-between'>
                  <p className='text-xs text-muted-foreground'>
                    {resumeCount === undefined
                      ? '简历数量暂不可用'
                      : `共 ${resumeCount} 份简历`}
                  </p>
                  <Button
                    variant='ghost'
                    size='sm'
                    className='h-7 gap-1 text-xs text-muted-foreground hover:text-foreground'
                    onClick={() => navigate('/resume')}
                  >
                    查看全部
                    <ArrowRight className='size-3' />
                  </Button>
                </div>
              </div>
            ) : (
              <Empty className='border-0 p-3'>
                <EmptyHeader>
                  <EmptyMedia variant='icon'>
                    <FileUser className='text-muted-foreground/50' />
                  </EmptyMedia>
                  <EmptyTitle className='text-sm'>
                    {unavailable
                      ? '— 动态暂不可用'
                      : timelineLoading
                        ? '正在加载动态'
                        : '暂无动态'}
                  </EmptyTitle>
                </EmptyHeader>
                {!unavailable && !timelineLoading && resumeCount === 0 && (
                  <EmptyContent>
                    <Button
                      variant='outline'
                      size='sm'
                      className='h-8 text-xs'
                      onClick={onCreate}
                    >
                      创建第一份简历
                    </Button>
                  </EmptyContent>
                )}
              </Empty>
            )}
          </AnimatedContent>
        </CardContent>
      </Card>
    </div>
  )
}

export default Entry

function QuickAction({
  title,
  icon,
  onClick,
  disabled,
  highlight,
  iconBg = 'bg-primary/10 text-primary',
}: {
  title: string
  icon: ReactNode
  onClick: MouseEventHandler<HTMLButtonElement>
  disabled?: boolean
  highlight?: boolean
  iconBg?: string
}) {
  return (
    <Button
      variant='ghost'
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'group h-auto min-w-0 justify-start gap-2 px-1 py-2 text-left motion-reduce:transition-none',
        highlight && 'font-medium',
      )}
    >
      <div
        className={cn(
          'flex size-8 items-center justify-center rounded-md transition-transform duration-(--ui-motion-base) ease-(--ui-motion-enter-ease)',
          'motion-reduce:transition-none',
          disabled && 'group-hover:scale-100 group-hover:rotate-0',
          iconBg,
        )}
      >
        {icon}
      </div>
      <span className='truncate text-sm font-medium'>{title}</span>
    </Button>
  )
}

// 时间线单条事件的图标 / 语义色配置
const TIMELINE_STYLES: Record<
  TimelineEventType,
  { icon: ReactNode; dot: string; ring: string }
> = {
  ai: {
    icon: <Sparkles className='size-3.5 text-violet-500' />,
    dot: 'bg-violet-500/10',
    ring: 'ring-violet-500/20',
  },
  edit: {
    icon: <PencilRuler className='size-3.5 text-blue-500' />,
    dot: 'bg-blue-500/10',
    ring: 'ring-blue-500/20',
  },
  apply: {
    icon: <Send className='size-3.5 text-emerald-500' />,
    dot: 'bg-emerald-500/10',
    ring: 'ring-emerald-500/20',
  },
}

function TimelineItem({
  event,
  isLast,
  onClick,
}: {
  event: TimelineEvent
  isLast?: boolean
  onClick?: () => void
}) {
  const style = TIMELINE_STYLES[event.type]

  return (
    <li className='group flex gap-3'>
      {/* 图标 + 连接线 */}
      <div className='flex flex-col items-center'>
        <div
          className={cn(
            'flex size-7 items-center justify-center rounded-full ring-1 shrink-0 transition-colors duration-(--ui-motion-fast) ease-(--ui-motion-enter-ease)',
            style.dot,
            style.ring,
          )}
        >
          {style.icon}
        </div>
        {!isLast && <div className='w-px flex-1 bg-border' />}
      </div>
      {/* 事件内容 */}
      <button
        type='button'
        onClick={onClick}
        className={cn(
          'flex min-w-0 flex-1 items-start justify-between gap-2 rounded-md px-2 py-1.5 -mx-2 text-left',
          'transition-colors duration-(--ui-motion-fast) ease-(--ui-motion-enter-ease) hover:bg-muted/50',
          isLast ? '' : 'mb-1',
        )}
      >
        <p className='text-sm truncate group-hover:text-foreground transition-colors duration-(--ui-motion-fast) ease-(--ui-motion-enter-ease)'>
          {event.title}
        </p>
        <span className='text-xs text-muted-foreground/70 whitespace-nowrap pt-0.5'>
          {event.time}
        </span>
      </button>
    </li>
  )
}
