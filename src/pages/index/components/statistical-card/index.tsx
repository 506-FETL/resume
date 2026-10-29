import type { ReactNode } from 'react'
import type { DashboardFunnel } from '../../insights'
import { ArrowRight, CircleCheckBig, Send, Sparkles, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { AnimatedContent } from '@/components/motion/animated-content'
import { Card, CardContent } from '@/components/ui/card'
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
    <div className='grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4'>
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
    <Card
      className={cn(
        'h-full py-3 transition-[background-color,border-color,box-shadow,color,transform] duration-(--ui-motion-base) ease-(--ui-motion-enter-ease) hover:shadow-md',
        className,
      )}
    >
      <CardContent className='px-4 py-0'>
        <div className='flex items-start gap-3'>
          <div className={cn('p-2 rounded-lg shrink-0', iconBg)}>{icon}</div>
          <div className='min-w-0 flex-1'>
            <p className='text-xs font-medium text-muted-foreground mb-1'>
              {title}
            </p>
            <div className='flex items-baseline gap-1'>
              {placeholder ? (
                <h3 className='text-xl md:text-2xl font-semibold tracking-tight text-muted-foreground'>
                  {placeholder}
                </h3>
              ) : (
                <>
                  <h3 className='text-xl md:text-2xl font-semibold tracking-tight'>
                    <NumberTicker
                      value={value}
                      className='text-xl md:text-2xl font-semibold tracking-tight text-foreground'
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
          </div>
        </div>
        {onGuideClick ? (
          <button
            type='button'
            onClick={onGuideClick}
            className='group mt-3 flex items-center gap-0.5 text-xs text-muted-foreground/80 transition-colors hover:text-foreground'
          >
            <span className='truncate'>{description}</span>
            <ArrowRight className='size-3 shrink-0 transition-transform group-hover:translate-x-0.5' />
          </button>
        ) : (
          description && (
            <p className='mt-3 truncate text-xs text-muted-foreground/80'>
              {description}
            </p>
          )
        )}
      </CardContent>
    </Card>
  )
}
