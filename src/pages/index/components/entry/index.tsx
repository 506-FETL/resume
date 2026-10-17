import type { ReactNode } from 'react'
import type { TimelineEvent, TimelineEventType } from '../../insights'
import { ArrowRight, Clock, FileUser, FolderKanban, LayoutTemplate, PencilRuler, Plus, Send, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { AnimatedContent } from '@/components/motion/animated-content'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyContent, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { cn } from '@/lib/utils'

function Entry({
  events,
  timelineLoading,
  resumeCount,
}: {
  events: TimelineEvent[]
  timelineLoading: boolean
  resumeCount: number
}) {
  const navigate = useNavigate()

  return (
    <div className="grid gap-4 grid-cols-1 md:gap-5 md:grid-cols-2">
      {/* 快捷操作 */}
      <Card className="flex flex-col">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-primary/8">
              <Sparkles className="size-4 text-primary" />
            </div>
            <CardTitle className="text-sm font-medium">快捷操作</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex-1 pt-0">
          <div className="grid gap-2.5 grid-cols-2 h-full">
            <QuickAction
              title="创建简历"
              icon={<Plus className="size-4" />}
              onClick={() => navigate('/resume')}
              iconBg="bg-primary/10 text-primary"
              highlight
            />
            <QuickAction
              title="求职看板"
              icon={<FolderKanban className="size-4" />}
              onClick={() => navigate('/tracker')}
              iconBg="bg-blue-500/10 text-blue-500"
            />
            <QuickAction
              title="简历模板"
              icon={<LayoutTemplate className="size-4" />}
              onClick={() => navigate('/template')}
              iconBg="bg-violet-500/10 text-violet-500"
            />
            <QuickAction
              title="简历优化"
              icon={<PencilRuler className="size-4" />}
              onClick={() => navigate('/optimize')}
              iconBg="bg-emerald-500/10 text-emerald-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* 最近动态 */}
      <Card className="flex flex-col">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-primary/8">
              <Clock className="size-4 text-primary" />
            </div>
            <CardTitle className="text-sm font-medium">最近动态</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex-1 pt-0">
          <AnimatedContent animationKey={events.length > 0 ? 'ready' : timelineLoading ? 'loading' : 'empty'}>
            {events.length > 0
              ? (
                  <div className="flex flex-col gap-3">
                    <ol className="flex flex-col">
                      {events.map((event, index) => (
                        <TimelineItem
                          key={event.id}
                          event={event}
                          isLast={index === events.length - 1}
                          onClick={() => navigate(event.to)}
                        />
                      ))}
                    </ol>
                    <div className="pt-3 border-t flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        共
                        <span className="font-medium text-foreground mx-1">{resumeCount}</span>
                        份简历
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => navigate('/resume')}
                      >
                        查看全部
                        <ArrowRight className="size-3" />
                      </Button>
                    </div>
                  </div>
                )
              : (
                  <Empty className="h-45 border-0 p-0">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <FileUser className="text-muted-foreground/50" />
                      </EmptyMedia>
                      <EmptyTitle className="text-sm">
                        {timelineLoading ? '正在加载动态' : '暂无动态'}
                      </EmptyTitle>
                    </EmptyHeader>
                    <EmptyContent>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => navigate('/resume')}
                      >
                        创建第一份简历
                      </Button>
                    </EmptyContent>
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
  onClick: () => void
  disabled?: boolean
  highlight?: boolean
  iconBg?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'group flex flex-col items-start gap-2.5 rounded-lg border p-3 text-left transition-all duration-200',
        'motion-safe:hover:-translate-y-0.5 hover:shadow-sm hover:bg-accent/50 hover:border-border/80 motion-safe:active:scale-[0.98] motion-reduce:transition-none',
        highlight && 'bg-primary/3 border-primary/20 hover:border-primary/40 hover:bg-primary/6 hover:shadow-primary/10',
        disabled && 'cursor-default opacity-50 hover:translate-y-0 hover:shadow-none hover:bg-transparent hover:border-border',
      )}
    >
      <div className={cn(
        'flex size-8 items-center justify-center rounded-md transition-transform duration-200',
        'motion-safe:group-hover:scale-110 motion-safe:group-hover:-rotate-3 motion-reduce:transition-none',
        disabled && 'group-hover:scale-100 group-hover:rotate-0',
        iconBg,
      )}
      >
        {icon}
      </div>
      <p className="text-sm font-medium leading-none">{title}</p>
    </button>
  )
}

// 时间线单条事件的图标 / 语义色配置
const TIMELINE_STYLES: Record<TimelineEventType, { icon: ReactNode, dot: string, ring: string }> = {
  ai: {
    icon: <Sparkles className="size-3.5 text-violet-500" />,
    dot: 'bg-violet-500/10',
    ring: 'ring-violet-500/20',
  },
  edit: {
    icon: <PencilRuler className="size-3.5 text-blue-500" />,
    dot: 'bg-blue-500/10',
    ring: 'ring-blue-500/20',
  },
  apply: {
    icon: <Send className="size-3.5 text-emerald-500" />,
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
    <li className="group flex gap-3">
      {/* 图标 + 连接线 */}
      <div className="flex flex-col items-center">
        <div className={cn(
          'flex size-7 items-center justify-center rounded-full ring-1 shrink-0 transition-colors duration-150',
          style.dot,
          style.ring,
        )}
        >
          {style.icon}
        </div>
        {!isLast && <div className="w-px flex-1 bg-border" />}
      </div>
      {/* 事件内容 */}
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex flex-1 items-start justify-between gap-2 rounded-md px-2 py-1.5 -mx-2 text-left',
          'transition-colors duration-150 hover:bg-muted/50',
          isLast ? '' : 'mb-1',
        )}
      >
        <p className="text-sm truncate group-hover:text-foreground transition-colors duration-150">
          {event.title}
        </p>
        <span className="text-[10px] text-muted-foreground/70 whitespace-nowrap pt-0.5">{event.time}</span>
      </button>
    </li>
  )
}
