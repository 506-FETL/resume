import { lazy, Suspense } from 'react'
import { useSearchParams } from 'react-router-dom'
import ManagementDialogs from './components/management-dialogs'
import { motion } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { PageLayout } from '@/components/layout/page-layout'
import Content from './components/content'
import Header from './components/header'
import SharePagination from './components/pagination'
import Toolbar from './components/toolbar'
import { SHARE_MOTION } from './const'
import { useSharePageBootstrap } from './hooks/use-share-page-bootstrap'

const JobContextBar = lazy(() =>
  import('@/components/job-context').then(({ JobContextBar }) => ({
    default: JobContextBar,
  })),
)

export default function Management() {
  useSharePageBootstrap()

  const [params] = useSearchParams()
  const reduceMotion = useReducedMotion()

  return (
    <PageLayout className='h-full min-h-0 gap-4 overflow-hidden py-4 sm:gap-6 sm:py-6 [@media(max-height:500px)]:gap-2 [@media(max-height:500px)]:py-2'>
      <motion.div
        initial={false}
        animate={SHARE_MOTION.page.animate}
        transition={{
          ...SHARE_MOTION.page.transition,
          duration: reduceMotion ? 0 : SHARE_MOTION.page.transition.duration,
        }}
        className='flex min-h-0 min-w-0 flex-1 flex-col gap-4 sm:gap-6 [@media(max-height:500px)]:gap-2'
      >
        <div className='shrink-0 space-y-4 sm:space-y-6 [@media(max-height:500px)]:space-y-2'>
          <div className='empty:hidden [@media(max-height:500px)]:[&>div]:flex-nowrap [@media(max-height:500px)]:[&_a]:h-9'>
            {params.get('jobId') && (
              <Suspense fallback={null}>
                <JobContextBar />
              </Suspense>
            )}
          </div>
          <Header />
        </div>
        <section
          aria-label='分享链接'
          className='flex min-h-0 min-w-0 flex-1 flex-col gap-4 sm:gap-5 [@media(max-height:500px)]:gap-2'
        >
          <div className='shrink-0'>
            <Toolbar />
          </div>
          <div
            id='share-management-results'
            role='region'
            aria-label='分享链接列表'
            tabIndex={0}
            className='relative min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain outline-none focus-visible:ring-2 focus-visible:ring-ring/50 [scrollbar-gutter:stable]'
          >
            <Content />
          </div>
          <SharePagination />
        </section>
        <ManagementDialogs />
      </motion.div>
    </PageLayout>
  )
}
