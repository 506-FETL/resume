import { Grid2X2, List, Search, Upload } from 'lucide-react'
import { PageHeader, PageLayout } from '@/components/layout/page-layout'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  EXPERIENCE_DESCRIPTION,
  EXPERIENCE_GRID_CLASS,
} from '@/pages/experience/const'

export function ExperienceRowsSkeleton({
  view = 'grid',
}: {
  view?: 'grid' | 'list'
}) {
  return (
    <div
      aria-label='正在读取资料'
      className={view === 'grid' ? EXPERIENCE_GRID_CLASS : 'space-y-3'}
    >
      {Array.from({ length: view === 'grid' ? 6 : 5 }, (_, index) => (
        <div
          key={index}
          aria-hidden
          className={
            view === 'grid'
              ? 'flex min-h-56 flex-col gap-3 rounded-xl border border-border/70 p-4'
              : 'flex items-center gap-3 rounded-lg p-3'
          }
        >
          <Skeleton className='size-9 shrink-0 rounded-lg' />
          <div className={view === 'grid' ? 'space-y-3' : 'flex-1 space-y-2'}>
            <Skeleton className='h-5 w-3/4' />
            <Skeleton className='h-3 w-1/2' />
            <Skeleton
              className={view === 'grid' ? 'h-12 w-full' : 'h-3 w-full'}
            />
          </div>
          {view === 'grid' && <Skeleton className='mt-auto h-3 w-28' />}
        </div>
      ))}
    </div>
  )
}

export function ExperiencePageSkeleton() {
  return (
    <PageLayout workspace className='gap-5'>
      <PageHeader
        title='职业档案'
        description={EXPERIENCE_DESCRIPTION}
        actions={
          <>
            <Button variant='outline' disabled>
              粘贴文字
            </Button>
            <Button disabled>
              <Upload />
              上传资料
            </Button>
          </>
        }
      />
      <div className='grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 @min-[700px]/workspace:grid-cols-[auto_minmax(0,1fr)_auto]'>
        <Tabs value='all'>
          <TabsList variant='line'>
            <TabsTrigger value='all' disabled>
              全部
            </TabsTrigger>
            <TabsTrigger value='files' disabled>
              文件
            </TabsTrigger>
            <TabsTrigger value='paste' disabled>
              文字
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <InputGroup className='col-span-2 row-start-2 @min-[700px]/workspace:col-span-1 @min-[700px]/workspace:col-start-2 @min-[700px]/workspace:row-start-1 @min-[700px]/workspace:max-w-sm @min-[700px]/workspace:justify-self-end'>
          <InputGroupAddon>
            <Search aria-hidden />
          </InputGroupAddon>
          <InputGroupInput placeholder='搜索资料名称' disabled />
        </InputGroup>
        <ButtonGroup
          aria-label='资料显示方式'
          className='col-start-2 row-start-1 @min-[700px]/workspace:col-start-3'
        >
          <Button variant='outline' size='icon' disabled aria-label='网格视图'>
            <Grid2X2 />
          </Button>
          <Button variant='outline' size='icon' disabled aria-label='列表视图'>
            <List />
          </Button>
        </ButtonGroup>
      </div>
      <div className='flex shrink-0 items-center justify-between text-xs text-muted-foreground'>
        <span>正在读取资料</span>
        <span>最近更新</span>
      </div>
      <div className='min-h-0 flex-1 overflow-hidden px-0.5 py-0.5'>
        <ExperienceRowsSkeleton />
      </div>
    </PageLayout>
  )
}
