import { ArrowDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import useAtsStore from '../../store'
import { calculateRating, calculateReadabilityRating } from '../../utils'
import '@fontsource/racing-sans-one/latin-400.css'

interface OverviewSummaryCardProps {
  loading: boolean
}

export default function OverviewSummaryCard({
  loading,
}: OverviewSummaryCardProps) {
  const { currentAtsConfig } = useAtsStore()
  const { meta, readabilityIndex, summary } = currentAtsConfig ?? {}
  const assessment = meta?.rubricVersion === '2.0' ? meta.assessment : undefined

  if (loading) {
    return (
      <Card className='min-w-0 gap-0 rounded-lg py-0 shadow-none'>
        <CardContent className='grid gap-4 p-4 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-center md:p-5'>
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
      <Card className='min-w-0 gap-0 rounded-lg py-0 shadow-none'>
        <CardContent className='flex min-h-28 flex-col justify-center gap-2 p-4 md:p-5'>
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

  return (
    <Card className='relative isolate min-w-0 overflow-hidden gap-0 rounded-lg py-0 shadow-none'>
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
      <CardContent className='relative isolate grid min-w-0 items-center gap-5 p-4 sm:grid-cols-[10rem_minmax(0,1fr)] md:p-5 xl:grid-cols-[11rem_minmax(0,1fr)_8rem]'>
        <div className='relative z-10 space-y-2'>
          <div className='flex flex-wrap items-center gap-2'>
            <p className='text-xs font-medium text-muted-foreground'>
              简历评分
            </p>
            <Badge variant='secondary' className='rounded-full px-3'>
              {summary?.grade || '待评估'}
            </Badge>
          </div>
          <p
            className={cn(
              'text-3xl font-semibold tracking-tight tabular-nums',
              scoreAccent,
            )}
          >
            {overallScore}
            <span className='ml-1 text-sm font-normal text-muted-foreground'>
              / 100
            </span>
          </p>
        </div>
        <div className='relative z-10 min-w-0 space-y-3'>
          <h2 className='wrap-break-word text-base font-medium leading-7'>
            {assessment?.basisSummary ||
              readabilityIndex?.summary ||
              '已完成当前简历的综合评估'}
          </h2>
          {(currentAtsConfig.fixChecklist ?? []).some(
            (item) => !item.isDone,
          ) && (
            <Button asChild variant='outline' size='sm'>
              <a href='#optimization-findings'>
                查看待处理项
                <ArrowDown aria-hidden />
              </a>
            </Button>
          )}
        </div>

        <p className='relative z-10 border-t pt-3 text-xs text-muted-foreground sm:col-span-2 xl:col-span-1 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-5'>
          可读性指数
          <span
            className={cn(
              'ml-2 text-sm font-medium tabular-nums xl:mt-2 xl:ml-0 xl:block xl:text-xl',
              calculateReadabilityRating(readabilityScore),
            )}
          >
            {readabilityScore} / 10
          </span>
        </p>
      </CardContent>
    </Card>
  )
}
