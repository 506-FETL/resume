import { createRoot } from 'react-dom/client'
import { FileClock, Plus, Send } from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardAction,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from '@/components/ui/empty'
import '@/index.css'

createRoot(document.getElementById('root')!).render(
  <main className='mx-auto max-w-5xl space-y-7 p-8'>
    <header className='space-y-2'>
      <h1 className='text-xl font-semibold'>投递记录 · 两种布局方向</h1>
      <p className='text-sm text-muted-foreground'>
        布局示意，使用项目现有组件；未改动实际页面。
      </p>
    </header>
    <section className='space-y-3'>
      <h2 className='text-base font-semibold'>
        A · 紧凑分区（推荐，适合当前抽屉）
      </h2>
      <Card className='gap-0 border border-border py-0 shadow-none ring-0'>
        <CardHeader className='items-center border-b bg-muted/20 py-4'>
          <CardTitle className='flex items-center gap-2 text-base font-semibold'>
            投递记录<Badge variant='secondary'>0</Badge>
          </CardTitle>
          <CardAction>
            <Button size='sm'>
              <Plus />
              记录投递
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className='flex-row items-start gap-4 py-6'>
          <span className='flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted'>
            <FileClock className='size-5 text-muted-foreground' />
          </span>
          <div className='space-y-1'>
            <p className='text-sm font-medium'>还没有投递记录</p>
            <p className='text-sm text-muted-foreground'>
              已投递的岗位可以先记录，简历材料稍后补充。
            </p>
          </div>
        </CardContent>
      </Card>
      <p className='text-xs text-muted-foreground'>
        标题 16px / 600；状态 14px / 500；说明 14px /
        灰色。实际记录按日期与渠道排列，材料和备注为次级信息。
      </p>
    </section>
    <section className='space-y-3'>
      <h2 className='text-base font-semibold'>
        B · 居中空态（引导更明显，占用更多高度）
      </h2>
      <Card className='gap-0 border border-border py-0 shadow-none ring-0'>
        <CardHeader className='items-center border-b py-4'>
          <CardTitle className='text-base font-semibold'>投递记录</CardTitle>
        </CardHeader>
        <CardContent className='py-5'>
          <Empty className='gap-3 p-4'>
            <EmptyHeader>
              <EmptyMedia variant='icon'>
                <Send />
              </EmptyMedia>
              <EmptyTitle className='text-base font-semibold'>
                记录第一次投递
              </EmptyTitle>
              <EmptyDescription>
                已投递的岗位可以先记录，简历材料稍后补充。
              </EmptyDescription>
            </EmptyHeader>
            <Button size='sm'>
              <Plus />
              记录投递
            </Button>
          </Empty>
        </CardContent>
      </Card>
      <p className='text-xs text-muted-foreground'>
        空态中只放一个主按钮；有记录后，操作入口移回标题栏。
      </p>
    </section>
  </main>,
)
