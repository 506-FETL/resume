import type { ReactNode } from 'react'
import type { ActivityDay, AtsTrendPoint, FollowUpJob, FunnelStage } from '../../insights'
import type { ChartConfig } from '@/components/ui/chart'
import { Activity, ArrowRight, BellRing, LineChart as LineChartIcon, LoaderCircle, TrendingUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { cn } from '@/lib/utils'
import { NEXT_ACTION_TONE_CLASSES } from '@/pages/tracker/const'

// 图表统一高度与内边距：left=0 避免 Y 轴刻度被推出容器左缘裁切
const CHART_HEIGHT = 'h-[180px]'
const CHART_MARGIN = { top: 4, right: 8, left: 0, bottom: 0 } as const

// 卡片头：图标 chip + 标题 + 描述（复用首页既有视觉语言）
function CardHead({ icon, title, description }: { icon: ReactNode, title: string, description: string }) {
  return (
    <CardHeader className="pb-4">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-md bg-primary/8 text-primary">{icon}</div>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </div>
      <CardDescription className="text-xs">{description}</CardDescription>
    </CardHeader>
  )
}

// 图表加载中：占位与图表等高，居中显示旋转的 LoaderCircle（比默认 spinner 的放射状图标更利落）
function ChartLoading() {
  return (
    <div className={cn('flex w-full items-center justify-center', CHART_HEIGHT)}>
      <LoaderCircle className="size-6 animate-spin text-muted-foreground/60" aria-label="加载中" role="status" />
    </div>
  )
}

// 图表空态：与图表等高，点击跳转对应页面
function ChartEmpty({ icon, text, onClick }: { icon: ReactNode, text: string, onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('flex w-full flex-col items-center justify-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground', CHART_HEIGHT)}
    >
      {icon}
      {text}
    </button>
  )
}

// ==================== 待跟进岗位 Top3 ====================
function followUpTone(daysUntil: number | null): { text: string, tone: 'overdue' | 'today' | 'upcoming' } {
  if (daysUntil === null)
    return { text: '长时间未推进', tone: 'upcoming' }
  if (daysUntil < 0)
    return { text: `逾期 ${Math.abs(daysUntil)} 天`, tone: 'overdue' }
  if (daysUntil === 0)
    return { text: '今天跟进', tone: 'today' }
  if (daysUntil === 1)
    return { text: '明天跟进', tone: 'upcoming' }
  return { text: `${daysUntil} 天后`, tone: 'upcoming' }
}

export function FollowUpCard({ followUps, total }: { followUps: FollowUpJob[], total: number }) {
  const navigate = useNavigate()

  if (followUps.length === 0)
    return null

  return (
    <Card className="flex flex-col">
      <CardHead
        icon={<BellRing className="size-4" />}
        title="待跟进岗位"
        description="到期或长时间未推进，建议优先处理"
      />
      <CardContent className="flex-1 pt-0">
        <div className="flex flex-col gap-2">
          {followUps.map((job) => {
            const badge = followUpTone(job.daysUntil)
            return (
              <button
                type="button"
                key={job.id}
                onClick={() => navigate('/tracker')}
                className="group flex items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent/50 hover:border-border/80"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{job.company}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {job.position}
                    {' · '}
                    {job.statusLabel}
                  </p>
                </div>
                <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium', NEXT_ACTION_TONE_CLASSES[badge.tone])}>
                  {badge.text}
                </span>
              </button>
            )
          })}
        </div>
        {total > followUps.length && (
          <button
            type="button"
            onClick={() => navigate('/tracker')}
            className="mt-3 flex w-full items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            还有
            <span className="font-medium text-foreground">{total - followUps.length}</span>
            个待跟进
            <ArrowRight className="size-3" />
          </button>
        )}
      </CardContent>
    </Card>
  )
}

// ==================== 求职漏斗图 ====================
const funnelConfig = {
  count: { label: '岗位数', color: 'var(--chart-1)' },
} satisfies ChartConfig

export function FunnelCard({ funnel, loading }: { funnel: FunnelStage[], loading: boolean }) {
  const navigate = useNavigate()
  const hasData = funnel.some(stage => stage.count > 0)

  return (
    <Card className="flex flex-col">
      <CardHead
        icon={<TrendingUp className="size-4" />}
        title="求职漏斗"
        description="各阶段在办岗位分布"
      />
      <CardContent className="flex-1 pt-0">
        {loading
          ? <ChartLoading />
          : hasData
            ? (
                <ChartContainer config={funnelConfig} className={cn(CHART_HEIGHT, 'w-full')}>
                  <BarChart accessibilityLayer data={funnel} margin={CHART_MARGIN}>
                    <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                    <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={44} />
                  </BarChart>
                </ChartContainer>
              )
            : (
                <ChartEmpty
                  icon={<Activity className="size-8 text-muted-foreground/40" />}
                  text="去求职看板添加第一个岗位"
                  onClick={() => navigate('/tracker')}
                />
              )}
      </CardContent>
    </Card>
  )
}

// ==================== ATS 分数趋势图 ====================
const trendConfig = {
  score: { label: 'ATS 分', color: 'var(--chart-2)' },
} satisfies ChartConfig

export function AtsTrendCard({ trend, loading }: { trend: AtsTrendPoint[], loading: boolean }) {
  const navigate = useNavigate()
  // 单点也画，但至少 1 个才有意义
  const hasData = trend.length > 0

  return (
    <Card className="flex flex-col">
      <CardHead
        icon={<LineChartIcon className="size-4" />}
        title="ATS 分数趋势"
        description="最近 8 次检测得分"
      />
      <CardContent className="flex-1 pt-0">
        {loading
          ? <ChartLoading />
          : hasData
            ? (
                <ChartContainer config={trendConfig} className={cn(CHART_HEIGHT, 'w-full')}>
                  <AreaChart accessibilityLayer data={trend} margin={CHART_MARGIN}>
                    <defs>
                      <linearGradient id="ats-trend-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="index"
                      type="number"
                      domain={['dataMin', 'dataMax']}
                      // 显式给每个检测点一个刻度并 interval=0，避免 recharts 数值轴自动抽稀只剩首尾两个
                      ticks={trend.map(point => point.index)}
                      interval={0}
                      tickMargin={8}
                      height={24}
                      tickFormatter={(value: number) => trend[value]?.label ?? ''}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    />
                    <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={28} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent labelFormatter={(_, payload) => payload?.[0]?.payload?.fullLabel ?? ''} />}
                    />
                    <Area
                      dataKey="score"
                      type="monotone"
                      stroke="var(--chart-2)"
                      strokeWidth={2}
                      fill="url(#ats-trend-fill)"
                      // 常驻数据点：每次检测都有一个圆点，hover 时放大，避免只有折线看不出「几次检测」
                      dot={{ r: 3, fill: 'var(--chart-2)', stroke: 'var(--background)', strokeWidth: 1.5 }}
                      activeDot={{ r: 5, fill: 'var(--chart-2)', stroke: 'var(--background)', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ChartContainer>
              )
            : (
                <ChartEmpty
                  icon={<LineChartIcon className="size-8 text-muted-foreground/40" />}
                  text="去做一次 ATS 检测吧"
                  onClick={() => navigate('/optimize')}
                />
              )}
      </CardContent>
    </Card>
  )
}

// ==================== 本周活跃度 ====================
const activityConfig = {
  edits: { label: '编辑', color: 'var(--chart-1)' },
  applies: { label: '投递', color: 'var(--chart-3)' },
} satisfies ChartConfig

export function ActivityCard({ activity, loading }: { activity: ActivityDay[], loading: boolean }) {
  const total = activity.reduce((sum, day) => sum + day.total, 0)

  return (
    <Card className="flex flex-col">
      <CardHead
        icon={<Activity className="size-4" />}
        title="本周活跃度"
        description="本周的编辑与投递"
      />
      <CardContent className="flex-1 pt-0">
        {loading
          ? <ChartLoading />
          : total > 0
            ? (
                <ChartContainer config={activityConfig} className={cn(CHART_HEIGHT, 'w-full')}>
                  <BarChart accessibilityLayer data={activity} margin={CHART_MARGIN}>
                    <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                    <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                    <Bar dataKey="edits" stackId="a" fill="var(--chart-1)" radius={[0, 0, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="applies" stackId="a" fill="var(--chart-3)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ChartContainer>
              )
            : (
                <div className={cn('flex w-full flex-col items-center justify-center gap-1 text-sm text-muted-foreground', CHART_HEIGHT)}>
                  <Activity className="size-8 text-muted-foreground/40" />
                  本周还没有编辑或投递记录
                </div>
              )}
      </CardContent>
    </Card>
  )
}
