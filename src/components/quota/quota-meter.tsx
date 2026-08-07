import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { useAiQuota } from '@/hooks/use-ai-quota'
import { cn } from '@/lib/utils'
import { getQuotaTone, getUsedPercent } from './utils'

/**
 * Composer 底部的轻量额度提示：`今日剩余 X/20` + 细进度条。
 * 低额度（≤3）文案转告警色，用尽时提示明日恢复。低饱和、不喧宾夺主。
 */
export function QuotaMeter({ className }: { className?: string }) {
  const { quota, loading, error } = useAiQuota()

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center gap-2 py-1', className)}>
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-1 w-16 rounded-full" />
      </div>
    )
  }

  // 拉取失败或无数据时静默隐藏，不打扰输入
  if (error || !quota)
    return null

  const { remaining, dailyLimit, usedToday } = quota
  const tone = getQuotaTone(remaining)
  const percent = getUsedPercent(usedToday, dailyLimit)

  return (
    <div className={cn('flex items-center justify-center gap-2 py-1 text-xs', className)}>
      <span
        className={cn(
          'text-muted-foreground',
          tone === 'low' && 'text-amber-600 dark:text-amber-500',
          tone === 'empty' && 'text-destructive',
        )}
      >
        {tone === 'empty'
          ? '今日额度已用完，明日 0 点恢复'
          : `今日剩余 ${remaining}/${dailyLimit}`}
      </span>
      {tone !== 'empty' && (
        <Progress value={percent} className="h-1 w-16" />
      )}
    </div>
  )
}
