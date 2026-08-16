import { motion } from 'motion/react'
import { useEffect, useMemo } from 'react'
import Entry from './components/entry'
import Header from './components/header'
import { ActivityCard, AtsTrendCard, FollowUpCard, FunnelCard } from './components/insight-cards'
import StatisticalCard from './components/statistical-card'
import { TodoCard } from './components/todo'
import { useDashboardExtras, useDashboardInsights, useDashboardResources, useDashboardTimeline } from './insights'
import useIndexStore from './store'

const Container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
}
const MotionItem = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 300,
      damping: 24,
    },
  },
}

export default function DashboardPage() {
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

  // 今日焦点：优先展示最紧急的一条待办
  const focus = useMemo(() => {
    if (insights.loading || !insights.hasCloudResume)
      return undefined
    const top = insights.actions[0]
    return top ? `今日焦点：${top.count} ${top.label}` : '今日焦点：待办已清空，保持简历活跃'
  }, [insights.loading, insights.hasCloudResume, insights.actions])

  return (
    <motion.div
      variants={Container}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-5 md:gap-6 p-4 pb-8 md:p-6 lg:p-8 max-w-7xl mx-auto"
    >
      <motion.div variants={MotionItem}>
        <Header focus={focus} />
      </motion.div>

      <motion.div variants={MotionItem}>
        <TodoCard
          actions={insights.actions}
          loading={insights.loading}
          hasCloudResume={insights.hasCloudResume}
        />
      </motion.div>

      {!extras.followUpsLoading && extras.followUps.length > 0 && (
        <motion.div variants={MotionItem}>
          <FollowUpCard followUps={extras.followUps} total={extras.followUpTotal} />
        </motion.div>
      )}

      <motion.div variants={MotionItem}>
        <StatisticalCard
          funnel={insights.funnel}
          jobsLoading={insights.jobsLoading}
          atsLoading={insights.atsLoading}
        />
      </motion.div>

      <motion.div variants={MotionItem} className="grid gap-4 grid-cols-1 md:gap-5 md:grid-cols-2">
        <FunnelCard funnel={extras.funnel} loading={extras.funnelLoading} />
        <AtsTrendCard trend={extras.atsTrend} loading={extras.atsTrendLoading} />
      </motion.div>

      <motion.div variants={MotionItem}>
        <ActivityCard activity={extras.activity} loading={extras.activityLoading} />
      </motion.div>

      <motion.div variants={MotionItem}>
        <Entry events={timeline.events} timelineLoading={timeline.loading} resumeCount={resumes.length} />
      </motion.div>
    </motion.div>
  )
}
