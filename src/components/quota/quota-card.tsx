import { Infinity as InfinityIcon, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { useAiQuota } from '@/hooks/use-ai-quota'
import { cn } from '@/lib/utils'
import useUpgradeDialogStore from '@/store/upgrade-dialog'
import { getPlanBadge, getQuotaTone, getUsedPercent, normalizePlan } from './utils'

/**
 * 用户中心的额度卡片：展示 plan、今日已用/剩余、进度条、重置文案，
 * 并提供「升级」按钮（复用全局 UpgradeDialog）。root/max 为顶配，隐藏升级入口。
 */
export function QuotaCard() {
  const { quota, loading, error } = useAiQuota()
  const openDialog = useUpgradeDialogStore(s => s.openDialog)

  const tier = quota ? normalizePlan(quota.plan) : 'free'
  const showUpgrade = quota ? tier === 'free' || tier === 'pro' : false

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI 每日额度</CardTitle>
        <CardDescription>每日 0 点重置，免费版每日 20 次</CardDescription>
        {showUpgrade && (
          <CardAction>
            <Button size="sm" onClick={() => openDialog({ reason: 'manual' })}>
              <Sparkles />
              升级
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {loading
          ? <QuotaCardSkeleton />
          : error || !quota
            ? <p className="text-sm text-muted-foreground">额度信息加载失败，请稍后重试</p>
            : <QuotaCardBody quota={quota} />}
      </CardContent>
    </Card>
  )
}

function PlanPill({ plan }: { plan: string }) {
  const badge = getPlanBadge(plan)
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
        badge.className,
      )}
    >
      {badge.label}
    </span>
  )
}

function QuotaCardBody({ quota }: { quota: NonNullable<ReturnType<typeof useAiQuota>['quota']> }) {
  const { plan, remaining, dailyLimit, usedToday, unlimited } = quota
  const tone = getQuotaTone(remaining)
  const percent = getUsedPercent(usedToday, dailyLimit)

  if (unlimited) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <PlanPill plan={plan} />
          <span className="inline-flex items-center gap-1 text-sm font-medium text-amber-600 dark:text-amber-400">
            <InfinityIcon className="size-4" />
            无限额度
          </span>
        </div>
        <p className="text-sm text-muted-foreground">管理员账户</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <PlanPill plan={plan} />
        <span
          className={cn(
            'text-sm font-medium tabular-nums',
            tone === 'low' && 'text-amber-600 dark:text-amber-500',
            tone === 'empty' && 'text-destructive',
          )}
        >
          今日剩余
          {' '}
          {remaining}
          /
          {dailyLimit}
        </span>
      </div>
      <Progress value={percent} />
      <p className="text-sm text-muted-foreground">
        今日已用
        {' '}
        {usedToday}
        {' '}
        次，
        {tone === 'empty' ? '额度已用完，明日 0 点恢复' : '每日 0 点重置'}
      </p>
    </div>
  )
}

function QuotaCardSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-16 rounded-md" />
        <Skeleton className="h-5 w-24" />
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
      <Skeleton className="h-4 w-40" />
    </div>
  )
}
