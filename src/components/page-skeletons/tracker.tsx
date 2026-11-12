import {
  Archive,
  ArrowUpDown,
  BellRing,
  CheckCheck,
  ChevronDown,
  CircleHelp,
  Flag,
  Kanban,
  List,
  ListFilter,
  ListChecks,
  Plus,
  Search,
  Send,
  Users,
} from 'lucide-react'
import { PageLayout } from '@/components/layout/page-layout'
import { LoadingRegion } from '@/components/loading-skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useIsMobile } from '@/hooks/use-mobile'
import { BOARD_COLUMNS } from '@/pages/tracker/const'

export function TrackerContentSkeleton({
  viewMode = 'board',
}: {
  viewMode?: 'board' | 'list'
}) {
  const isMobile = useIsMobile()

  return (
    <LoadingRegion
      label='正在加载职位'
      className='flex min-h-0 min-w-0 flex-1 overflow-hidden'
    >
      {isMobile ? (
        <div className='w-full divide-y divide-border/60'>
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className='flex items-start gap-3 px-1 py-4'>
              <Skeleton className='size-10 shrink-0 rounded-xl' />
              <div className='min-w-0 flex-1 space-y-3'>
                <Skeleton className='h-5 w-3/4' />
                <Skeleton className='h-3 w-1/2' />
                <div className='flex gap-2'>
                  <Skeleton className='h-5 w-16' />
                  <Skeleton className='h-5 w-20' />
                </div>
              </div>
              <Skeleton className='size-8 shrink-0' />
            </div>
          ))}
        </div>
      ) : viewMode === 'list' ? (
        <div className='@container/jobs flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'>
          <div className='scrollbar-thin-subtle min-h-0 flex-1 overflow-auto'>
            <table className='w-full min-w-[420px] table-fixed text-sm'>
              <thead className='sticky top-0 z-10 bg-muted text-xs text-muted-foreground'>
                <tr>
                  <th className='w-[32%] px-3 py-3 text-left font-medium @min-[880px]/jobs:w-[26%]'>
                    公司 / 职位
                  </th>
                  <th className='hidden w-[14%] px-3 py-3 text-left font-medium @min-[880px]/jobs:table-cell'>
                    地点 / 薪资
                  </th>
                  <th className='w-[24%] px-3 py-3 text-left font-medium @min-[680px]/jobs:w-[20%] @min-[880px]/jobs:w-[16%]'>
                    当前阶段
                    <span className='mt-1 block text-xs'>未更新时间</span>
                  </th>
                  <th className='hidden w-[24%] px-3 py-3 text-left font-medium @min-[680px]/jobs:table-cell @min-[880px]/jobs:w-[20%]'>
                    下一步跟进
                  </th>
                  <th className='hidden w-[13%] px-3 py-3 text-left font-medium @min-[1100px]/jobs:table-cell'>
                    最近更新
                  </th>
                  <th className='w-16 px-3 py-3 text-right font-medium @min-[680px]/jobs:w-[18%]'>
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {[0, 1, 2, 3].map((item) => (
                  <tr key={item} className='border-t border-border/60'>
                    <td className='px-4 py-4'>
                      <div className='flex min-w-0 items-center gap-2.5'>
                        <Skeleton className='size-9 shrink-0 rounded-lg' />
                        <div className='min-w-0 flex-1 space-y-2'>
                          <Skeleton className='h-4 w-4/5' />
                          <Skeleton className='h-3 w-3/5' />
                        </div>
                      </div>
                    </td>
                    <td className='hidden space-y-2 px-3 py-4 @min-[880px]/jobs:table-cell'>
                      <Skeleton className='h-4 w-3/4' />
                      <Skeleton className='h-3 w-full' />
                    </td>
                    <td className='space-y-2 px-3 py-4'>
                      <Skeleton className='h-5 w-16 max-w-full' />
                      <Skeleton className='h-3 w-12 max-w-full' />
                    </td>
                    <td className='hidden space-y-2 px-3 py-4 @min-[680px]/jobs:table-cell'>
                      <Skeleton className='h-4 w-3/4' />
                      <Skeleton className='h-3 w-full' />
                    </td>
                    <td className='hidden px-3 py-4 @min-[1100px]/jobs:table-cell'>
                      <Skeleton className='h-4 w-full' />
                    </td>
                    <td className='px-3 py-4'>
                      <Skeleton className='ml-auto size-8' />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className='flex w-full gap-2'>
          {BOARD_COLUMNS.map((column) => (
            <div
              key={column.status}
              className='min-w-64 flex-1 space-y-3 rounded-xl bg-muted/40 p-3'
            >
              <div className='flex h-8 items-center justify-between'>
                <span className='text-sm font-medium'>{column.label}</span>
                <Skeleton className='h-4 w-5' />
              </div>
              <div className='space-y-3 rounded-xl border bg-card p-4'>
                <Skeleton className='size-8 rounded-lg' />
                <Skeleton className='h-4 w-3/4' />
                <Skeleton className='h-3 w-1/2' />
                <Skeleton className='h-5 w-20' />
              </div>
            </div>
          ))}
        </div>
      )}
    </LoadingRegion>
  )
}

export function TrackerPageSkeleton() {
  const isMobile = useIsMobile()

  return (
    <PageLayout
      workspace
      className='min-h-0 gap-4 md:gap-2 [@media(max-height:500px)]:gap-2 [@media(max-height:500px)]:py-2'
    >
      <header className='flex shrink-0 items-center justify-between gap-2'>
        <div className='flex min-w-0 flex-col gap-x-4 md:flex-row md:items-center'>
          <h1 className='text-2xl leading-8 font-semibold tracking-tight'>
            求职跟进
          </h1>
          <div className='flex items-center gap-1 text-xs text-muted-foreground'>
            {isMobile && (
              <>
                <span className='tabular-nums'>— 个职位</span>
                <span aria-hidden>·</span>
              </>
            )}
            <Button
              disabled
              variant='ghost'
              size='sm'
              className='h-8 gap-1 rounded-md px-1.5 text-xs text-muted-foreground sm:gap-1.5 sm:px-2'
            >
              响应率
              <Skeleton className='h-3.5 w-8' />
              <CircleHelp aria-hidden className='size-3.5!' />
            </Button>
          </div>
        </div>
        <Button
          disabled
          className='h-10 shrink-0 rounded-xl px-3 md:h-9 md:rounded-lg'
        >
          <Plus data-icon='inline-start' />
          {isMobile ? '新增' : '新增职位'}
        </Button>
      </header>
      <main
        aria-label='职位工作区'
        className='@container/tracker flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background md:border-t'
      >
        <div className='shrink-0 py-1 md:border-b md:py-3'>
          <div className='flex flex-col gap-2 md:gap-3'>
            <div className='hidden flex-wrap items-center justify-between gap-x-4 gap-y-2 md:flex'>
              <div className='flex flex-wrap items-center gap-1'>
                {[
                  { label: '全部职位', icon: null },
                  { label: '已投递', icon: Send },
                  { label: '面试中', icon: Users },
                  { label: '已录用', icon: CheckCheck },
                  { label: '待跟进', icon: BellRing },
                ].map(({ label, icon: Icon }) => (
                  <Button
                    key={label}
                    disabled
                    variant='ghost'
                    size='sm'
                    className='h-9 min-w-0 gap-2 rounded-lg px-3 text-muted-foreground'
                  >
                    {Icon && <Icon aria-hidden className='size-3.5' />}
                    {label}
                    <Skeleton className='h-4 w-5 shrink-0' />
                  </Button>
                ))}
              </div>
              <div className='ml-auto flex items-center gap-3'>
                <Tabs value='board'>
                  <TabsList className='h-9 rounded-lg bg-muted/70 p-1'>
                    <TabsTrigger disabled value='list' className='gap-1.5'>
                      <List data-icon='inline-start' />
                      列表
                    </TabsTrigger>
                    <TabsTrigger disabled value='board' className='gap-1.5'>
                      <Kanban data-icon='inline-start' />
                      看板
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <TrackerActionSkeleton />
              </div>
            </div>
            <div className='flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-3 md:gap-x-3'>
              <div className='flex min-w-0 basis-full items-center gap-2 md:max-w-lg md:flex-[1_1_18rem]'>
                <div className='relative min-w-0 flex-1'>
                  <Search className='absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground' />
                  <Input
                    disabled
                    placeholder='搜索职位…'
                    aria-label='搜索职位'
                    className='h-11 rounded-xl border-transparent bg-muted/50 pr-9 pl-9 shadow-none md:h-9 md:rounded-lg md:border-input md:bg-transparent'
                  />
                </div>
                <Button
                  disabled
                  variant={isMobile ? 'ghost' : 'outline'}
                  size={isMobile ? 'icon' : 'sm'}
                  aria-label='筛选职位'
                  className={
                    isMobile
                      ? 'size-11 shrink-0 rounded-xl text-muted-foreground'
                      : 'relative h-9 shrink-0 gap-1.5 rounded-lg px-2.5 shadow-none sm:px-3'
                  }
                >
                  {isMobile ? (
                    <ArrowUpDown className='size-4' />
                  ) : (
                    <>
                      <ListFilter className='size-4' />
                      <span>全部阶段</span>
                    </>
                  )}
                </Button>
              </div>
              <div className='flex basis-full items-center justify-between md:hidden'>
                <Tabs value='all' className='pb-1.5'>
                  <TabsList variant='line' className='h-11 gap-3'>
                    <TabsTrigger value='all' disabled className='h-11 px-1'>
                      全部 —
                    </TabsTrigger>
                    <TabsTrigger value='pending' disabled className='h-11 px-1'>
                      待跟进 —
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <Button
                  disabled
                  variant='ghost'
                  className='h-10 px-2 font-normal'
                >
                  全部阶段
                  <ChevronDown />
                </Button>
              </div>
              <Button
                disabled
                variant='outline'
                className='min-w-0 flex-1 justify-between md:w-44 md:flex-none'
              >
                全部公司
                <ChevronDown />
              </Button>
              <div className='md:hidden'>
                <TrackerActionSkeleton />
              </div>
            </div>
          </div>
        </div>
        <div aria-hidden className='min-h-7 shrink-0' />
        <div className='flex min-h-0 min-w-0 flex-1 flex-col pt-1 md:pt-3'>
          <TrackerContentSkeleton />
        </div>
      </main>
    </PageLayout>
  )
}

function TrackerActionSkeleton() {
  return (
    <div className='flex items-center gap-1'>
      {[
        { icon: Flag, label: '重点关注' },
        { icon: Archive, label: '归档职位' },
        { icon: ListChecks, label: '批量管理' },
      ].map(({ icon: Icon, label }) => (
        <Button
          key={label}
          disabled
          variant='ghost'
          size='icon'
          aria-label={label}
        >
          <Icon />
        </Button>
      ))}
    </div>
  )
}
