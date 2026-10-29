import { ArrowDown, CheckCircle2, FileText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import useAtsStore from '../../store'
import { calculateRating, calculateReadabilityRating } from '../../utils'
import '@fontsource/racing-sans-one/latin-400.css'

interface OverviewSummaryCardProps {
  completedTasks: number
  loading: boolean
  progress: number
  totalTasks: number
}

export default function OverviewSummaryCard({
  completedTasks,
  loading,
  progress,
  totalTasks,
}: OverviewSummaryCardProps) {
  const { currentAtsConfig } = useAtsStore()
  const { meta, readabilityIndex, summary } = currentAtsConfig ?? {}
  const assessment = meta?.rubricVersion === '2.0' ? meta.assessment : undefined

  if (loading) {
    return (
      <Card className='min-w-0 shadow-none'>
        <CardContent className='grid gap-5 p-5 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-center md:p-6'>
          <div className='space-y-3'>
            <Skeleton className='h-3 w-16' />
            <Skeleton className='h-12 w-24' />
            <Skeleton className='h-2 w-full' />
          </div>
          <div className='space-y-3'>
            <Skeleton className='h-5 w-3/4' />
            <Skeleton className='h-4 w-full' />
            <Skeleton className='h-4 w-2/3' />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!currentAtsConfig) {
    return (
      <Card className='min-w-0 shadow-none'>
        <CardContent className='flex min-h-28 flex-col justify-center gap-2 p-5 md:p-6'>
          <p className='text-sm font-semibold'>检测结果</p>
          <p className='max-w-xl text-sm leading-6 text-muted-foreground'>
            选择简历后，点击“开始检测”。
          </p>
        </CardContent>
      </Card>
    )
  }

  const overallScore = summary?.overall_score ?? 0
  const scoreAccent = calculateRating(overallScore)
  const readabilityScore = readabilityIndex?.score ?? 0

  const progressDescription =
    totalTasks === 0
      ? '当前没有待处理建议'
      : progress === 100
        ? '当前优化项已全部处理'
        : `${completedTasks}/${totalTasks} 项已完成`

  return (
    <Card className='relative isolate min-w-0 overflow-hidden shadow-none'>
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0 -z-1 select-none',
          scoreAccent,
        )}
      >
        <div
          className='absolute inset-0 opacity-[0.14] dark:opacity-[0.12]'
          style={{
            backgroundImage:
              'radial-gradient(ellipse 400px 240px at top left, currentColor, transparent 72%)',
          }}
        />
        <span className="absolute -top-5 -left-1 -rotate-6 font-['Racing_Sans_One',sans-serif] text-[9rem] leading-none font-normal tracking-tighter tabular-nums opacity-[0.08] sm:text-[10rem] dark:opacity-[0.12]">
          {overallScore}
        </span>
      </div>
      <CardContent className='relative isolate min-w-0 p-5 md:p-6'>
        <div className='relative z-10 min-w-0 pb-2'>
          <div className='flex flex-wrap items-start justify-between gap-2'>
            <p className='text-xs font-medium tracking-wide text-muted-foreground'>
              检测结果
            </p>
          </div>

          <div className='mt-3 min-w-0 space-y-3'>
            <div className='flex flex-wrap items-center gap-2'>
              <p className='text-xs font-medium text-muted-foreground'>
                简历评分
              </p>
              <Badge variant='secondary' className='rounded-full px-3'>
                {summary?.grade || '待评估'}
              </Badge>
              <span
                className={cn(
                  'text-3xl font-semibold tracking-tight tabular-nums',
                  scoreAccent,
                )}
              >
                {overallScore} / 100
              </span>
            </div>
            <h2 className='wrap-break-word text-base font-medium leading-7'>
              {assessment?.basisSummary ||
                readabilityIndex?.summary ||
                '已完成当前简历的综合评估'}
            </h2>
            {totalTasks > completedTasks && (
              <Button asChild variant='outline' size='sm'>
                <a href='#optimization-findings'>
                  查看待处理项
                  <ArrowDown aria-hidden />
                </a>
              </Button>
            )}
          </div>
        </div>

        <div className='relative z-10 mt-4 grid gap-3 border-t border-border/60 pt-4 grid-cols-2'>
          <div className='flex min-w-0 items-start gap-3'>
            <div className='hidden size-8 shrink-0 items-center justify-center sm:flex rounded-md bg-primary/10 text-primary'>
              <FileText className='size-4' />
            </div>
            <div className='min-w-0'>
              <p className='text-xs text-muted-foreground'>可读性指数</p>
              <p
                className={cn(
                  'mt-0.5 text-lg font-semibold',
                  calculateReadabilityRating(readabilityScore),
                )}
              >
                {readabilityScore}
                <span className='ml-1 text-xs font-normal text-muted-foreground'>
                  / 10
                </span>
              </p>
            </div>
          </div>

          <div className='flex min-w-0 items-start gap-3'>
            <div className='hidden size-8 shrink-0 items-center justify-center sm:flex rounded-md bg-primary/10 text-primary'>
              <CheckCircle2 className='size-4' />
            </div>
            <div className='min-w-0 flex-1'>
              <div className='flex items-center justify-between gap-3'>
                <p className='text-xs text-muted-foreground'>处理进度</p>
                <p className='text-sm font-semibold'>{progress}%</p>
              </div>
              <Progress
                value={progress}
                aria-label={`处理进度 ${progress}%`}
                className='mt-2 h-1.5'
              />
              <p className='mt-1.5 text-xs leading-5 text-muted-foreground'>
                {progressDescription}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
