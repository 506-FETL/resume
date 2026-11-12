import {
  ArrowRight,
  Activity,
  BellRing,
  CircleCheckBig,
  Clock,
  Flag,
  FolderKanban,
  LayoutTemplate,
  LineChart,
  MessagesSquare,
  PencilRuler,
  Plus,
  Send,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader, PageLayout } from '@/components/layout/page-layout'
import { LoadingRegion } from '@/components/loading-skeleton'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import GettingStarted from '@/pages/index/components/getting-started'
import {
  RecentResumesSkeleton,
  StatSkeleton,
  TimelineSkeleton,
  TodoSkeleton,
} from '@/pages/index/components/skeleton'

export function DashboardPriorityContentSkeleton({ title }: { title: string }) {
  return (
    <LoadingRegion label={`正在加载${title}`} className='space-y-4 py-2'>
      {[0, 1].map((item) => (
        <div key={item} className='space-y-2'>
          <Skeleton className='h-4 w-3/5' />
          <Skeleton className='h-3 w-4/5' />
        </div>
      ))}
    </LoadingRegion>
  )
}

export function DashboardChartSkeleton() {
  return (
    <LoadingRegion label='正在加载图表' className='h-[140px] w-full py-2'>
      <Skeleton className='h-full w-full rounded-sm' />
    </LoadingRegion>
  )
}

export function DashboardPageSkeleton({ guest = false }: { guest?: boolean }) {
  return (
    <PageLayout>
      <PageHeader
        title='首页'
        description={
          guest
            ? '创建或导入简历，从已有内容开始。'
            : '继续编辑简历，查看待办与求职进展。'
        }
        actions={<Button disabled>创建简历</Button>}
      />
      {guest && <GettingStarted isAuthenticated={false} hasResume={false} />}
      <section className='flex flex-col gap-3'>
        <div className='flex items-center justify-between gap-3'>
          <h2 className='text-base font-semibold'>最近简历</h2>
          <Button asChild variant='ghost' size='sm'>
            <Link to='/resume'>查看全部</Link>
          </Button>
        </div>
        <RecentResumesSkeleton />
      </section>
      {!guest && (
        <>
          <section
            aria-label='求职提醒'
            className='grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-3'
          >
            {[
              {
                title: '下一场面试',
                icon: MessagesSquare,
                accent: 'text-violet-500 dark:text-violet-400',
              },
              {
                title: '到期跟进',
                icon: BellRing,
                accent: 'text-amber-500 dark:text-amber-400',
              },
              {
                title: '重点关注',
                icon: Flag,
                accent: 'text-red-500 dark:text-red-400',
              },
            ].map(({ title, icon: Icon, accent }) => (
              <Card
                key={title}
                className='relative isolate h-full min-w-0 gap-0 rounded-lg border bg-card py-5 shadow-none ring-0'
              >
                <div
                  aria-hidden
                  className={`pointer-events-none absolute inset-0 -z-1 select-none ${accent}`}
                >
                  <div
                    className='absolute inset-0 opacity-[0.14] dark:opacity-[0.12]'
                    style={{
                      backgroundImage:
                        'radial-gradient(ellipse 180px 110px at top left, currentColor, transparent 72%)',
                    }}
                  />
                  <Icon
                    className='absolute -top-3 -left-2 size-22 -rotate-12 opacity-[0.09] dark:opacity-[0.12]'
                    strokeWidth={1.25}
                  />
                </div>
                <CardHeader className='grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-5 pb-2'>
                  <CardTitle className='text-base font-semibold'>
                    {title}
                  </CardTitle>
                  <Button
                    asChild
                    variant='ghost'
                    size='sm'
                    className='h-auto gap-1 px-1 py-1 text-xs text-muted-foreground'
                  >
                    <Link
                      to={
                        title === '重点关注' ? '/tracker?focus=1' : '/tracker'
                      }
                    >
                      查看全部
                      <ArrowRight className='size-3' />
                    </Link>
                  </Button>
                </CardHeader>
                <CardContent className='px-5 pt-0'>
                  <DashboardPriorityContentSkeleton title={title} />
                </CardContent>
              </Card>
            ))}
          </section>
          <div className='grid min-w-0 items-start gap-6 lg:grid-cols-2'>
            <Card className='h-full gap-0 overflow-hidden rounded-t-lg rounded-b-none border-x border-t border-foreground/10 bg-transparent py-5 shadow-none ring-0'>
              <h2 className='px-5 pb-3 text-base font-semibold'>今日待办</h2>
              <CardContent className='px-5 pt-0'>
                <TodoSkeleton />
              </CardContent>
            </Card>
            <section className='@container min-w-0'>
              <h2 className='mb-3 text-base font-semibold'>求职概况</h2>
              <div className='grid min-w-0 gap-x-6 @sm:grid-cols-2'>
                {[
                  { title: '已投递', icon: Send },
                  { title: '面试进行中', icon: Users },
                  { title: '收到 Offer', icon: CircleCheckBig },
                  { title: '平均 ATS 分', icon: Sparkles },
                ].map(({ title, icon: Icon }) => (
                  <StatSkeleton
                    key={title}
                    title={title}
                    icon={<Icon className='size-4 text-muted-foreground' />}
                  />
                ))}
              </div>
            </section>
          </div>
          <div className='grid min-w-0 items-start gap-6 lg:grid-cols-3'>
            {[
              {
                title: '求职漏斗',
                description: '各阶段在办岗位分布',
                icon: TrendingUp,
              },
              {
                title: 'ATS 分数趋势',
                description: '最近 8 次检测得分',
                icon: LineChart,
              },
              {
                title: '本周活跃度',
                description: '本周的编辑与投递',
                icon: Activity,
              },
            ].map(({ title, description, icon: Icon }) => (
              <Card
                key={title}
                className='flex min-w-0 flex-col gap-0 rounded-none border-0 border-t bg-transparent py-5 shadow-none ring-0'
              >
                <CardHeader className='px-0 pb-4'>
                  <div className='flex items-center gap-2'>
                    <Icon className='size-4 text-muted-foreground' />
                    <CardTitle className='text-sm font-medium'>
                      {title}
                    </CardTitle>
                  </div>
                  <CardDescription className='text-xs'>
                    {description}
                  </CardDescription>
                </CardHeader>
                <CardContent className='min-w-0 flex-1 px-0 pt-0'>
                  <DashboardChartSkeleton />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className='grid min-w-0 items-start gap-8 lg:grid-cols-2'>
            {[
              { title: '快捷操作', icon: Sparkles },
              { title: '最近动态', icon: Clock },
            ].map(({ title, icon: Icon }) => (
              <Card
                key={title}
                className='flex min-w-0 flex-col gap-0 rounded-none border-0 border-t bg-transparent py-5 shadow-none ring-0'
              >
                <CardHeader className='px-0 pb-4'>
                  <div className='flex items-center gap-2'>
                    <div className='rounded-md bg-primary/8 p-1.5'>
                      <Icon className='size-4 text-primary' />
                    </div>
                    <CardTitle className='text-base font-semibold'>
                      {title}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className='min-w-0 flex-1 px-0 pt-0'>
                  {title === '最近动态' ? (
                    <TimelineSkeleton />
                  ) : (
                    <div className='grid grid-cols-2 gap-2.5'>
                      {[
                        {
                          label: '创建简历',
                          icon: Plus,
                          color: 'bg-primary/10 text-primary',
                        },
                        {
                          label: '求职看板',
                          icon: FolderKanban,
                          color: 'bg-blue-500/10 text-blue-500',
                        },
                        {
                          label: '简历模板',
                          icon: LayoutTemplate,
                          color: 'bg-violet-500/10 text-violet-500',
                        },
                        {
                          label: '简历优化',
                          icon: PencilRuler,
                          color: 'bg-emerald-500/10 text-emerald-500',
                        },
                      ].map(({ label, icon: ActionIcon, color }) => (
                        <Button
                          key={label}
                          disabled
                          variant='ghost'
                          className='h-auto min-w-0 justify-start gap-2 px-1 py-2 text-left'
                        >
                          <span
                            className={`flex size-8 items-center justify-center rounded-md ${color}`}
                          >
                            <ActionIcon className='size-4' />
                          </span>
                          <span className='truncate text-sm font-medium'>
                            {label}
                          </span>
                        </Button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </PageLayout>
  )
}
