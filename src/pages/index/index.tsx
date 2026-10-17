import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useMemo } from 'react'
import { DURATION, EASE } from '@/lib/motion'
import Entry from './components/entry'
import Header from './components/header'
import { ActivityCard, AtsTrendCard, FollowUpCard, FunnelCard } from './components/insight-cards'
import StatisticalCard from './components/statistical-card'
import { TodoCard } from './components/todo'
import { useDashboardExtras, useDashboardInsights, useDashboardResources, useDashboardTimeline } from './insights'
import useIndexStore from './store'

export default function DashboardPage() {
  const reduceMotion = useReducedMotion()
  const container = {
    hidden: { opacity: 1 },
    show: { opacity: 1, transition: { staggerChildren: reduceMotion ? 0 : 0.03 } },
  }
  const item = {
    hidden: { opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 8 },
    show: { opacity: 1, y: 0, transition: { duration: reduceMotion ? 0 : DURATION.base, ease: EASE.out } },
  }
  const loadData = useIndexStore(s => s.loadData)
  const resumes = useIndexStore(s => s.resumes)
  const resumesLoading = useIndexStore(s => s.loading)
  const isOnline = useIndexStore(s => s.isOnline)
  const resources = useDashboardResources(!resumesLoading || isOnline, isOnline)
  const insights = useDashboardInsights(resumes, resumesLoading, resources)
  const extras = useDashboardExtras(resumes, resumesLoading, resources)
  const timeline = useDashboardTimeline(resumes, resumesLoading, resources)

  useEffect(() => {
    loadData()
  }, [loadData])

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-5 md:gap-6 p-4 pb-8 md:p-6 lg:p-8 max-w-7xl mx-auto"
    >
      <motion.div variants={item}>
        <Header />
      </motion.div>

      <motion.div variants={item}>
        <TodoCard
          actions={insights.actions}
          loading={insights.loading}
          isAuthenticated={isOnline}
          hasCloudResume={insights.hasCloudResume}
        />
      </motion.div>

      <AnimatePresence initial={false}>
        {!extras.followUpsLoading && extras.followUps.length > 0 && (
          <motion.div
            key="follow-ups"
            initial={{ opacity: reduceMotion ? 1 : 0, height: reduceMotion ? 'auto' : 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0, transition: { duration: reduceMotion ? 0 : DURATION.fast, ease: EASE.in } }}
            transition={{ duration: reduceMotion ? 0 : DURATION.base, ease: EASE.out }}
            className="overflow-hidden"
          >
            <FollowUpCard followUps={extras.followUps} total={extras.followUpTotal} />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div variants={item}>
        <StatisticalCard
          funnel={insights.funnel}
          jobsLoading={insights.jobsLoading}
          atsLoading={insights.atsLoading}
        />
      </motion.div>

      <motion.div variants={item} className="grid gap-4 grid-cols-1 md:gap-5 md:grid-cols-2">
        <FunnelCard funnel={extras.funnel} loading={extras.funnelLoading} />
        <AtsTrendCard trend={extras.atsTrend} loading={extras.atsTrendLoading} />
      </motion.div>

      <motion.div variants={item}>
        <ActivityCard activity={extras.activity} loading={extras.activityLoading} />
      </motion.div>

      <motion.div variants={item}>
        <Entry events={timeline.events} timelineLoading={timeline.loading} resumeCount={resumes.length} />
      </motion.div>
    </motion.div>
  )
}
