import type { LucideIcon } from 'lucide-react'
import type { DashboardAction, DashboardActionTone } from '../../insights'
import { AlertCircle, ArrowRight, CircleCheckBig, FileSearch, ListChecks, Send, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { TodoSkeleton } from '../skeleton'
import { TodoHeader } from './todo-header'

interface TodoCardProps {
  actions: DashboardAction[]
  loading: boolean
  hasCloudResume: boolean
}

const TONE_STYLES: Record<DashboardActionTone, { icon: LucideIcon, box: string, count: string }> = {
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

export function TodoCard({ actions, loading, hasCloudResume }: TodoCardProps) {
  const navigate = useNavigate()

  return (
    <Card className="overflow-hidden">
      <TodoHeader />
      <CardContent className="pt-0">
        {loading
          ? <TodoSkeleton />
          : !hasCloudResume
              ? <EmptyState icon={Sparkles} title="登录并同步简历后开启求职看板" hint="投递、面试与优化待办都会在这里聚合提醒" />
              : actions.length === 0
                ? <EmptyState icon={CircleCheckBig} title="待办都处理完啦" hint="保持简历活跃，随时准备好下一次投递" tone="positive" />
                : (
                    <div className="flex flex-col gap-2.5">
                      {actions.map((action) => {
                        const tone = TONE_STYLES[action.tone]
                        const Icon = tone.icon
                        return (
                          <button
                            type="button"
                            key={action.id}
                            onClick={() => navigate(action.to)}
                            className="group flex items-center gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary/30 hover:bg-accent/40"
                          >
                            <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', tone.box)}>
                              <Icon className="size-[18px]" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium">
                                <span className={cn('mr-1 text-base font-semibold tabular-nums', tone.count)}>
                                  {action.count}
                                </span>
                                {action.label}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">{action.hint}</p>
                            </div>
                            <ArrowRight className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                          </button>
                        )
                      })}
                    </div>
                  )}
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
  hint: string
  tone?: 'muted' | 'positive'
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8 text-center">
      <div
        className={cn(
          'flex size-10 items-center justify-center rounded-full',
          tone === 'positive' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground',
        )}
      >
        <Icon className="size-5" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-xs text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}
