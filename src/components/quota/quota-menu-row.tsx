import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { useAiQuota } from '@/hooks/use-ai-quota'
import { cn } from '@/lib/utils'
import { getQuotaTone, getUsedPercent } from './utils'

/**
 * 账户下拉菜单里的额度行：`今日 AI 额度` + `剩余 X/20` + 小进度条。
 * 作为只读信息块渲染，非可点击菜单项。
 */
export function QuotaMenuRow() {
  const { quota, loading, error } = useAiQuota()

  if (loading) {
    return (
      <div className="flex flex-col gap-1.5 px-2 py-1.5">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-1.5 w-full rounded-full" />
      </div>
    )
  }

  if (error || !quota)
    return null

  const { remaining, dailyLimit, usedToday } = quota
  const tone = getQuotaTone(remaining)
  const percent = getUsedPercent(usedToday, dailyLimit)

  return (
    <div className="flex flex-col gap-1.5 px-2 py-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">今日 AI 额度</span>
        <span
          className={cn(
            'font-medium tabular-nums',
            tone === 'low' && 'text-amber-600 dark:text-amber-500',
            tone === 'empty' && 'text-destructive',
          )}
        >
          剩余
          {' '}
          {remaining}
          /
          {dailyLimit}
        </span>
      </div>
      <Progress value={percent} className="h-1.5" />
    </div>
  )
}
