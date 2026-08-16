import type { ReactNode } from 'react'
import type { DashboardFunnel } from '../../insights'
import { ArrowRight, CircleCheckBig, Send, Sparkles, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { NumberTicker } from '@/components/ui/number-ticker'
import { cn } from '@/lib/utils'
import { StatSkeleton } from '../skeleton'

interface StatisticalCardProps {
  funnel: DashboardFunnel
  jobsLoading: boolean
  atsLoading: boolean
}

function StatisticalCard({ funnel, jobsLoading, atsLoading }: StatisticalCardProps) {
  const navigate = useNavigate()
  const hasAts = funnel.avgAtsScore !== null

  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
      {jobsLoading
        ? (
            <>
              <StatSkeleton />
              <StatSkeleton />
              <StatSkeleton />
            </>
          )
        : (
            <>
              <StatCard
                title="已投递"
                value={funnel.applied}
                description={funnel.applied > 0 ? '累计投递的岗位数' : '去求职看板添加第一个岗位'}
                guide={funnel.applied === 0}
                onGuideClick={funnel.applied === 0 ? () => navigate('/tracker') : undefined}
                icon={<Send className="size-4 text-blue-500" />}
                iconBg="bg-blue-500/8"
              />
              <StatCard
                title="面试进行中"
                value={funnel.interview}
                description={funnel.interview > 0 ? '进入面试阶段的岗位' : '还没有面试安排'}
                guide={funnel.interview === 0}
                icon={<Users className="size-4 text-violet-500" />}
                iconBg="bg-violet-500/8"
              />
              <StatCard
                title="收到 Offer"
                value={funnel.offer}
                description={funnel.offer > 0 ? '已拿到录用的岗位' : '继续加油，Offer 在路上'}
                guide={funnel.offer === 0}
                icon={<CircleCheckBig className="size-4 text-emerald-500" />}
                iconBg="bg-emerald-500/8"
              />
            </>
          )}
      {atsLoading
        ? <StatSkeleton />
        : (
            <StatCard
              title="平均 ATS 分"
              value={funnel.avgAtsScore ?? 0}
              suffix={hasAts ? '分' : undefined}
              placeholder={hasAts ? undefined : '—'}
              description={
                funnel.atsResumeCount > 0
                  ? `${funnel.atsResumeCount} 份简历检测均分`
                  : '去做一次 ATS 检测吧'
              }
              guide={funnel.atsResumeCount === 0}
              onGuideClick={funnel.atsResumeCount === 0 ? () => navigate('/optimize') : undefined}
              icon={<Sparkles className="size-4 text-primary" />}
              iconBg="bg-primary/8"
            />
          )}
    </div>
  )
}

export default StatisticalCard

// 统计卡片组件
interface StatCardProps {
  title: string
  value: number
  description: string
  icon: ReactNode
  className?: string
  iconBg?: string
  suffix?: string
  placeholder?: string
  guide?: boolean
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
  guide,
  onGuideClick,
}: StatCardProps) {
  return (
    <Card className={cn('transition-all duration-200 hover:shadow-md', className)}>
      <CardContent className="p-4 md:p-5">
        <div className="flex items-start gap-3">
          <div className={cn('p-2 rounded-lg shrink-0', iconBg)}>
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground mb-1">{title}</p>
            <div className="flex items-baseline gap-1">
              {placeholder
                ? (
                    <h3 className="text-xl md:text-2xl font-semibold tracking-tight text-muted-foreground">
                      {placeholder}
                    </h3>
                  )
                : (
                    <>
                      <h3 className="text-xl md:text-2xl font-semibold tracking-tight">
                        <NumberTicker value={value} className="text-xl md:text-2xl font-semibold tracking-tight text-foreground" />
                      </h3>
                      {suffix && (
                        <span className="text-xs font-medium text-muted-foreground">{suffix}</span>
                      )}
                    </>
                  )}
            </div>
          </div>
        </div>
        {onGuideClick
          ? (
              <button
                type="button"
                onClick={onGuideClick}
                className="group mt-3 flex items-center gap-0.5 text-[11px] text-muted-foreground/80 transition-colors hover:text-foreground"
              >
                <span className="truncate">{description}</span>
                <ArrowRight className="size-3 shrink-0 transition-transform group-hover:translate-x-0.5" />
              </button>
            )
          : (
              <p className={cn(
                'mt-3 text-[11px] truncate',
                guide ? 'text-muted-foreground/70 italic' : 'text-muted-foreground/80',
              )}
              >
                {description}
              </p>
            )}
      </CardContent>
    </Card>
  )
}
