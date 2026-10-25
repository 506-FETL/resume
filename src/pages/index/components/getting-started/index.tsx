import type { MouseEventHandler } from 'react'
import { ArrowRight, FilePlus2, LayoutTemplate } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { GETTING_STARTED_STEPS } from '../../const'

interface GettingStartedProps {
  isAuthenticated: boolean
  hasResume: boolean
  onCreate: MouseEventHandler<HTMLButtonElement>
}

export default function GettingStarted({
  isAuthenticated,
  hasResume,
  onCreate,
}: GettingStartedProps) {
  return (
    <section
      aria-labelledby='getting-started-title'
      className='overflow-hidden rounded-xl border bg-card'
    >
      <div className='grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-10'>
        <div className='min-w-0'>
          <h2
            id='getting-started-title'
            className='text-xl font-semibold tracking-tight sm:text-2xl'
          >
            {hasResume ? '继续编辑简历' : '创建你的第一份简历'}
          </h2>
          <p className='mt-3 max-w-lg text-sm leading-6 text-muted-foreground'>
            {hasResume
              ? '最近编辑的简历'
              : '可以导入旧简历，也可以选择示例开始写。'}
          </p>
          <div className='mt-5 flex flex-wrap gap-2'>
            {hasResume ? (
              <Button asChild>
                <Link to='/resume'>
                  查看我的简历
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
            ) : (
              <Button onClick={onCreate}>
                <FilePlus2 aria-hidden />
                创建第一份简历
              </Button>
            )}
            <Button asChild variant='outline'>
              <Link to='/template'>
                <LayoutTemplate aria-hidden />
                浏览模板
              </Link>
            </Button>
          </div>
        </div>
        <ol className='flex flex-col gap-4 border-t pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6'>
          {GETTING_STARTED_STEPS.map((step, index) => (
            <li key={step.title} className='flex gap-3'>
              <span className='flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs tabular-nums text-muted-foreground'>
                {index + 1}
              </span>
              <div className='min-w-0'>
                <p className='text-sm font-medium'>{step.title}</p>
                <p className='mt-1 text-xs leading-5 text-muted-foreground'>
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <div className='flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t bg-muted/20 px-5 py-3 text-xs leading-5 text-muted-foreground sm:px-6'>
        {isAuthenticated ? (
          <p>已经有想投的岗位？可以先记到求职看板里。</p>
        ) : (
          <p>
            不登录也能使用，简历会保存在这个浏览器里。清理浏览器数据前，记得导出备份或登录同步。
          </p>
        )}
        <Link
          to={isAuthenticated ? '/tracker' : '/login?redirect=%2Fresume'}
          className='inline-flex shrink-0 items-center gap-1 rounded-sm text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
        >
          {isAuthenticated ? '记录目标岗位' : '登录并同步'}
          <ArrowRight className='size-3' aria-hidden />
        </Link>
      </div>
    </section>
  )
}
