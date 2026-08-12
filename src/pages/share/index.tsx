import { motion, useReducedMotion } from 'motion/react'
import { getResumeSnapshotById } from '@/lib/supabase/resume/share'
import Content from './components/content'
import DeleteDialog from './components/delete-dialog'
import Header from './components/header'
import SettingsDialog from './components/settings-dialog'
import Toolbar from './components/toolbar'
import VersionDialog from './components/version-dialog'
import { SHARE_MOTION } from './const'
import { useSharePageBootstrap } from './hooks/use-share-page-bootstrap'

export default function Management() {
  useSharePageBootstrap()
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      initial={reduceMotion ? false : SHARE_MOTION.page.initial}
      animate={SHARE_MOTION.page.animate}
      transition={{
        ...SHARE_MOTION.page.transition,
        duration: reduceMotion ? 0 : SHARE_MOTION.page.transition.duration,
      }}
      className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 md:p-8"
    >
      <Header />
      <Toolbar />
      <Content />
      <SettingsDialog />
      <DeleteDialog />
      <VersionDialog getCurrentSnapshot={getResumeSnapshotById} />
    </motion.div>
  )
}
