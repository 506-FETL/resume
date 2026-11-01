import { ArrowDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { isAtsFindingPending } from '@/lib/ats'
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
  const { currentAtsConfig, loadError, analysisError } = useAtsStore()
  const { meta, readabilityIndex, summary } = currentAtsConfig ?? {}
  const assessment = meta?.rubricVersion === '2.0' ? meta.assessment : undefined

  if (loading) {
    return (
      <section aria-label='正在读取检测报告' className='min-w-0 border-b py-6'>
        <div className='grid gap-6 sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-center md:gap-10'>
          <div className='space-y-3'>
            <Skeleton className='h-3 w-16' />
            <Skeleton className='h-12 w-24' />
            <Skeleton className='h-2 w-full' />
          </div>
          <div className='space-y-3'>
            <Skeleton className='h-7 w-3/4' />
            <Skeleton className='h-7 w-full' />
            <Skeleton className='h-4 w-1/3' />
          </div>
        </div>
      </section>
    )
  }

  if (!currentAtsConfig) {
    return (
      <section className='flex min-h-28 min-w-0 flex-col justify-center gap-2 border-b py-6'>
        <h2 className='text-lg font-semibold'>
          {loadError || analysisError ? '检测报告尚未就绪' : '检测结果'}
        </h2>
        <p className='max-w-xl text-sm leading-6 text-muted-foreground'>
          {loadError
            ? '重新加载成功后，可在这里查看评分和建议。'
            : analysisError
              ? '本次检测未完成，重试后可查看评分和建议。'
              : '选择简历后，点击“开始检测”。'}
        </p>
      </section>
    )
  }

  const overallScore = summary?.overall_score ?? 0
  const scoreAccent = calculateRating(overallScore)
  const readabilityScore = readabilityIndex?.score ?? 0

  const hasPendingFindings = Object.values(currentAtsConfig.findings).some(
    (findings) => findings.some(isAtsFindingPending),
  )

  return (
    <section className='relative isolate min-w-0 border-b py-6 sm:py-8'>
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-y-0 left-0 -z-1 w-72 max-w-full overflow-hidden rounded-xl select-none',
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
      <div className='relative grid min-w-0 items-center gap-6 sm:grid-cols-[11rem_minmax(0,1fr)] md:gap-10'>
        <div className='relative z-10 space-y-3'>
          <p
            className={cn(
              'text-5xl font-semibold tracking-[-0.03em] tabular-nums',
              scoreAccent,
            )}
          >
            {overallScore}
            <span className='ml-1 text-sm font-normal text-muted-foreground'>
              / 100
            </span>
          </p>
          <div className='flex flex-wrap items-center gap-2'>
            <p className='text-xs font-medium text-muted-foreground'>
              简历评分
            </p>
            <Badge variant='secondary' className='rounded-full px-2'>
              {summary?.grade || '待评估'}
            </Badge>
          </div>
        </div>
        <div className='relative z-10 min-w-0 space-y-5'>
          <h2 className='max-w-[38ch] wrap-break-word text-[22px] leading-[1.5] font-semibold tracking-tight text-balance md:text-2xl'>
            {assessment?.basisSummary ||
              readabilityIndex?.summary ||
              '已完成当前简历的综合评估'}
          </h2>
          <div className='flex flex-wrap items-center gap-x-6 gap-y-3'>
            {hasPendingFindings && (
              <Button asChild variant='outline' size='sm'>
                <a href='#optimization-findings'>
                  查看待处理项
                  <ArrowDown aria-hidden />
                </a>
              </Button>
            )}
            <p className='text-xs text-muted-foreground'>
              可读性指数
              <span
                className={cn(
                  'ml-2 text-sm font-medium tabular-nums',
                  calculateReadabilityRating(readabilityScore),
                )}
              >
                {readabilityScore} / 10
              </span>
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
