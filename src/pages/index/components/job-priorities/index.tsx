import type { LucideIcon } from 'lucide-react'
import type { DashboardResources } from '../../insights'
import type { JobPriorityItem } from '../../job-priorities'
import { ArrowRight, BellRing, Flag, MessagesSquare } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AnimatedContent } from '@/components/motion/animated-content'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { buildJobPriorities } from '../../job-priorities'

export default function JobPriorities({
  resources,
}: {
  resources: DashboardResources
}) {
  const { interviews, followUps, focused } = buildJobPriorities(
    resources.jobs.data,
  )

  return (
    <section
      aria-label='求职提醒'
      className='grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-3'
    >
      <PriorityCard
        title='下一场面试'
        icon={MessagesSquare}
        accent='text-violet-500 dark:text-violet-400'
        badgeAccent='bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300'
        items={interviews}
        resource={resources.jobs}
        empty='暂无已安排的面试'
      />
      <PriorityCard
        title='到期跟进'
        icon={BellRing}
        accent='text-amber-500 dark:text-amber-400'
        badgeAccent='bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
        items={followUps}
        resource={resources.jobs}
        empty='暂无到期或久未推进的岗位'
      />
      <PriorityCard
        title='重点关注'
        icon={Flag}
        accent='text-red-500 dark:text-red-400'
        badgeAccent='bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
        items={focused}
        resource={resources.jobs}
        empty='还没有重点关注的职位'
        allTo='/tracker?focus=1'
      />
    </section>
  )
}

function PriorityCard({
  title,
  icon: Icon,
  accent,
  badgeAccent,
  items,
  resource,
  empty,
  emptyHint,
  allTo = '/tracker',
}: {
  title: string
  icon: LucideIcon
  accent: string
  badgeAccent: string
  items: JobPriorityItem[]
  resource: Pick<
    DashboardResources['jobs'],
    'loading' | 'error' | 'hasLoaded' | 'retry'
  >
  empty: string
  emptyHint?: string
  allTo?: string
}) {
  const pending = resource.loading && !resource.hasLoaded
  const unavailable = Boolean(resource.error) && !resource.hasLoaded

  return (
    <Card className='relative isolate h-full min-w-0 gap-0 rounded-lg border bg-card py-5 shadow-none ring-0'>
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
        <CardTitle className='flex items-center gap-2 text-base font-semibold'>
          {title}
          {resource.hasLoaded && items.length > 0 && (
            <Badge
              variant='secondary'
              className={`tabular-nums ${badgeAccent}`}
            >
              {items.length}
            </Badge>
          )}
        </CardTitle>
        <Button
          asChild
          variant='ghost'
          size='sm'
          className='h-auto shrink-0 gap-1 px-1 py-1 text-xs text-muted-foreground'
        >
          <Link to={allTo} aria-label={`查看全部${title}`}>
            查看全部
            <ArrowRight className='size-3' aria-hidden />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className='px-5 pt-0'>
        <AnimatedContent
          animationKey={
            pending
              ? 'loading'
              : unavailable
                ? 'error'
                : items.length
                  ? 'ready'
                  : 'empty'
          }
        >
          {pending ? (
            <div
              role='status'
              className='flex items-center gap-2 py-2 text-sm text-muted-foreground'
            >
              <Spinner aria-hidden className='motion-reduce:animate-none' />
              正在加载
            </div>
          ) : unavailable ? (
            <p className='py-2 text-sm text-muted-foreground'>
              暂时无法读取{title}
            </p>
          ) : items.length === 0 ? (
            <div className='py-2 text-muted-foreground'>
              <p className='text-sm'>{empty}</p>
              {emptyHint && <p className='mt-1 text-xs'>{emptyHint}</p>}
            </div>
          ) : (
            <div className='flex flex-col gap-2'>
              {items.slice(0, 2).map((item) => (
                <Button
                  key={item.id}
                  variant='ghost'
                  asChild
                  className='h-auto w-full justify-start px-2 py-2 text-left'
                >
                  <Link to={item.to}>
                    <span className='min-w-0 flex-1'>
                      <span className='block truncate text-sm font-medium'>
                        {item.title}
                      </span>
                      <span className='block truncate text-xs font-normal text-muted-foreground'>
                        {item.detail}
                      </span>
                    </span>
                    <ArrowRight className='size-4 shrink-0' aria-hidden />
                  </Link>
                </Button>
              ))}
            </div>
          )}
        </AnimatedContent>
        {resource.error && (
          <div
            role='status'
            className='mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground'
          >
            <span>
              {resource.hasLoaded ? '刷新失败，保留上次数据' : '加载失败'}
            </span>
            <Button size='sm' variant='ghost' onClick={resource.retry}>
              重试
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
