import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { PageLayout } from '@/components/layout/page-layout'

export default function NotFound() {
  return (
    <PageLayout width='narrow' className='flex min-h-[60svh] items-center'>
      <section className='mx-auto w-full max-w-md space-y-6 py-12'>
        <p className='text-sm font-medium tabular-nums text-muted-foreground'>
          404
        </p>
        <div className='space-y-3'>
          <h1 className='text-2xl leading-8 font-semibold tracking-tight'>
            找不到这个页面
          </h1>
          <p className='text-sm leading-6 text-muted-foreground'>
            链接可能有误，或页面已被移除。你可以回到首页继续处理简历和求职进度。
          </p>
        </div>
        <Button asChild>
          <Link to='/'>
            <ArrowLeft aria-hidden />
            返回首页
          </Link>
        </Button>
      </section>
    </PageLayout>
  )
}
