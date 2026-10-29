import type { ReactNode } from 'react'
import type { DashboardFunnel } from '../../insights'
import { ArrowRight, CircleCheckBig, Send, Sparkles, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { AnimatedContent } from '@/components/motion/animated-content'
import { Button } from '@/components/ui/button'
import { NumberTicker } from '@/components/ui/number-ticker'
import { cn } from '@/lib/utils'
import { StatSkeleton } from '../skeleton'

interface StatisticalCardProps {
  funnel: DashboardFunnel
  jobsLoading: boolean
  atsLoading: boolean
  jobsUnavailable?: boolean
  atsUnavailable?: boolean
}

function StatisticalCard({
  funnel,
  jobsLoading,
  atsLoading,
  jobsUnavailable,
  atsUnavailable,
}: StatisticalCardProps) {
  const navigate = useNavigate()
  const hasAts = funnel.avgAtsScore !== null

  return (
    <section aria-label='求职概况' className='@container min-w-0'>
      <h2 className='mb-3 text-base font-semibold'>求职概况</h2>
      <div className='grid min-w-0 gap-x-6 @sm:grid-cols-2'>
        <AnimatedContent
          animationKey={jobsLoading ? 'loading' : 'ready'}
          className='h-full'
        >
          {jobsLoading ? (
            <StatSkeleton />
          ) : (
            <StatCard
              title='已投递'
              placeholder={jobsUnavailable ? '—' : undefined}
              value={funnel.applied}
              description={funnel.applied > 0 ? '累计投递的岗位数' : '添加岗位'}
              onGuideClick={
                funnel.applied === 0 ? () => navigate('/tracker') : undefined
              }
              icon={<Send className='size-4 text-blue-500' />}
              iconBg='bg-blue-500/8'
            />
          )}
        </AnimatedContent>
        <AnimatedContent
          animationKey={jobsLoading ? 'loading' : 'ready'}
          className='h-full'
        >
          {jobsLoading ? (
            <StatSkeleton />
          ) : (
            <StatCard
              title='面试进行中'
              placeholder={jobsUnavailable ? '—' : undefined}
              value={funnel.interview}
              icon={<Users className='size-4 text-violet-500' />}
              iconBg='bg-violet-500/8'
            />
          )}
        </AnimatedContent>
        <AnimatedContent
          animationKey={jobsLoading ? 'loading' : 'ready'}
          className='h-full'
        >
          {jobsLoading ? (
            <StatSkeleton />
          ) : (
            <StatCard
              title='收到 Offer'
              placeholder={jobsUnavailable ? '—' : undefined}
              value={funnel.offer}
              icon={<CircleCheckBig className='size-4 text-emerald-500' />}
              iconBg='bg-emerald-500/8'
            />
          )}
        </AnimatedContent>
        <AnimatedContent
          animationKey={atsLoading ? 'loading' : 'ready'}
          className='h-full'
        >
          {atsLoading ? (
            <StatSkeleton />
          ) : (
            <StatCard
              title='平均 ATS 分'
              value={funnel.avgAtsScore ?? 0}
              suffix={hasAts ? '分' : undefined}
              placeholder={hasAts && !atsUnavailable ? undefined : '—'}
              description={
                atsUnavailable
                  ? '检测数据暂不可用'
                  : funnel.atsResumeCount > 0
                    ? `${funnel.atsResumeCount} 份简历检测均分`
                    : '开始 ATS 检测'
              }
              onGuideClick={
                !atsUnavailable && funnel.atsResumeCount === 0
                  ? () => navigate('/optimize')
                  : undefined
              }
              icon={<Sparkles className='size-4 text-primary' />}
              iconBg='bg-primary/8'
            />
          )}
        </AnimatedContent>
      </div>
    </section>
  )
}

export default StatisticalCard

// 统计卡片组件
interface StatCardProps {
  title: string
  value: number
  description?: string
  icon: ReactNode
  className?: string
  iconBg?: string
  suffix?: string
  placeholder?: string
  onGuideClick?: () => void
}

function StatCard({
  title,
  value,
  description,
  icon,
  className,
  iconBg = 'bg-primary/8',
  suffix,
  placeholder,
  onGuideClick,
}: StatCardProps) {
  return (
    <div className={cn('flex h-full min-w-0 flex-col gap-1.5 py-3', className)}>
      <div className='flex min-w-0 items-center gap-2'>
        <div className={cn('shrink-0', iconBg && 'text-muted-foreground')}>
          {icon}
        </div>
        <p className='text-xs font-medium text-muted-foreground'>{title}</p>
      </div>
      <div className='flex items-baseline gap-1'>
        {placeholder ? (
          <h3 className='text-2xl font-semibold tracking-tight text-muted-foreground'>
            {placeholder}
          </h3>
        ) : (
          <>
            <h3 className='text-2xl font-semibold tracking-tight'>
              <NumberTicker
                value={value}
                className='text-2xl font-semibold tracking-tight text-foreground'
              />
            </h3>
            {suffix && (
              <span className='text-xs font-medium text-muted-foreground'>
                {suffix}
              </span>
            )}
          </>
        )}
      </div>
      <div className='min-h-4 text-xs text-muted-foreground/80'>
        {onGuideClick ? (
          <Button
            variant='ghost'
            size='sm'
            onClick={onGuideClick}
            className='group h-auto gap-1 p-0 text-xs text-muted-foreground'
          >
            <span className='truncate'>{description}</span>
            <ArrowRight className='size-3 shrink-0 motion-reduce:transition-none' />
          </Button>
        ) : (
          description && <p className='truncate'>{description}</p>
        )}
      </div>
    </div>
  )
}
