import { JobContextBar } from '@/components/job-context'
import { motion } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { PageLayout } from '@/components/layout/page-layout'
import { getResumeSnapshotById } from '@/lib/supabase/resume/share'
import ArchiveDialog from './components/archive-dialog'
import Content from './components/content'
import DeleteDialog from './components/delete-dialog'
import Header from './components/header'
import Overview from './components/overview'
import SettingsDialog from './components/settings-dialog'
import Toolbar from './components/toolbar'
import VersionDialog from './components/version-dialog'
import { SHARE_MOTION } from './const'
import { useSharePageBootstrap } from './hooks/use-share-page-bootstrap'

export default function Management() {
  useSharePageBootstrap()

  const reduceMotion = useReducedMotion()

  return (
    <PageLayout>
      <motion.div
        initial={reduceMotion ? false : SHARE_MOTION.page.initial}
        animate={SHARE_MOTION.page.animate}
        transition={{
          ...SHARE_MOTION.page.transition,
          duration: reduceMotion ? 0 : SHARE_MOTION.page.transition.duration,
        }}
        className='flex min-w-0 flex-col gap-6'
      >
        <JobContextBar />
        <Header />
        <Overview />
        <section aria-label='分享链接' className='min-w-0 space-y-5'>
          <Toolbar />
          <Content />
        </section>
        <ArchiveDialog />
        <SettingsDialog />
        <DeleteDialog />
        <VersionDialog getCurrentSnapshot={getResumeSnapshotById} />
      </motion.div>
    </PageLayout>
  )
}
