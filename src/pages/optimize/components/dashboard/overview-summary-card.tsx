import { CheckCircle2, FileText, Target } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import useAtsStore from '../../store'
import { calculateRating, calculateReadabilityRating } from '../../utils'

interface OverviewSummaryCardProps {
  completedTasks: number
  loading: boolean
  progress: number
  totalTasks: number
}

export default function OverviewSummaryCard({ completedTasks, loading, progress, totalTasks }: OverviewSummaryCardProps) {
  const { currentAtsConfig } = useAtsStore()
  const { meta, readabilityIndex, summary } = currentAtsConfig ?? {}
  const assessment = meta?.rubricVersion === '2.0' ? meta.assessment : undefined

  if (loading) {
    return (
      <Card className="min-w-0 border-primary/15 shadow-sm">
        <CardContent className="grid gap-5 p-5 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-center md:p-6">
          <div className="space-y-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-12 w-24" />
            <Skeleton className="h-2 w-full" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!currentAtsConfig) {
    return (
      <Card className="min-w-0 border-primary/15 shadow-sm">
        <CardContent className="flex min-h-52 flex-col justify-center gap-2 p-5 md:p-6">
          <p className="text-sm font-semibold">综合评分</p>
          <p className="max-w-xl text-sm leading-6 text-muted-foreground">
            选择简历并开始检测后，这里会展示综合结论、可读性和优化完成度。
          </p>
        </CardContent>
      </Card>
    )
  }

  const overallScore = summary?.overall_score ?? 0
  const readabilityScore = readabilityIndex?.score ?? 0
  const progressDescription = totalTasks === 0
    ? '当前未发现必须修改项'
    : progress === 100
      ? '当前优化项已全部处理'
      : `${completedTasks}/${totalTasks} 项已完成`

  return (
    <Card className="min-w-0 border-primary/15 shadow-sm">
      <CardContent className="grid min-w-0 gap-5 p-5 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:items-center md:gap-6 md:p-6">
        <div className="min-w-0 sm:border-r sm:border-border/60 sm:pr-5">
          <p className="text-xs font-medium text-muted-foreground">综合评分</p>
          <div className="mt-2 flex items-end gap-2">
            <span className={cn('text-5xl font-bold tracking-tight', calculateRating(overallScore))}>
              {overallScore}
            </span>
            <span className="pb-1 text-sm text-muted-foreground">/ 100</span>
          </div>
          <p className="mt-1 text-sm font-medium">{summary?.grade || '待评估'}</p>
          <Progress value={overallScore} aria-label={`综合评分 ${overallScore} 分`} className="mt-4 h-2" />
        </div>

        <div className="min-w-0 space-y-4">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-medium text-muted-foreground">本次评分结论</p>
              {meta?.rubricVersion === '2.0' && (
                <Badge variant="secondary" className="rounded-full">内容自适应评分 2.0</Badge>
              )}
            </div>
            <h2 className="wrap-break-word text-base font-semibold leading-6 md:text-lg">
              {assessment?.basisSummary || readabilityIndex?.summary || '已完成当前简历的综合评估'}
            </h2>
            {assessment?.candidateProfile && (
              <p className="wrap-break-word text-sm leading-6 text-muted-foreground">
                {assessment.candidateProfile}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {assessment?.inferredTarget && (
                <Badge variant="outline" className="max-w-full rounded-full">
                  <Target className="size-3.5" />
                  <span className="truncate">{assessment.inferredTarget}</span>
                </Badge>
              )}
              {assessment?.evaluatedSections.length
                ? (
                    <Badge variant="outline" className="rounded-full">
                      已评估
                      {' '}
                      {assessment.evaluatedSections.length}
                      {' '}
                      项真实内容
                    </Badge>
                  )
                : null}
            </div>
          </div>

          <div className="grid gap-3 border-t border-border/60 pt-4 sm:grid-cols-2">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <FileText className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">可读性指数</p>
                <p className={cn('mt-0.5 text-lg font-semibold', calculateReadabilityRating(readabilityScore))}>
                  {readabilityScore}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">/ 10</span>
                </p>
                {readabilityIndex?.summary && (
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{readabilityIndex.summary}</p>
                )}
              </div>
            </div>

            <div className="flex min-w-0 items-start gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <CheckCircle2 className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">优化完成度</p>
                  <p className="text-sm font-semibold">
                    {progress}
                    %
                  </p>
                </div>
                <Progress value={progress} aria-label={`优化完成度 ${progress}%`} className="mt-2 h-1.5" />
                <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{progressDescription}</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
