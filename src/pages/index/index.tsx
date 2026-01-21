import type { Resume } from './type'
import type { ResumeType } from '@/store/resume/current'
import { motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { getAllOfflineResumes } from '@/lib/offline-resume-manager'
import { getAllResumesFromUser } from '@/lib/supabase/resume/form'
import { getCurrentUser } from '@/lib/supabase/user'
import { diffDates } from '@/utils/date'
import Charts from './components/charts'
import Entry from './components/Entry'
import Header from './components/Header'
import StatisticalCard from './components/statistical-card'
import { TodoCard } from './components/todo'

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
  const [resumes, setResumes] = useState<Resume[]>([])
  const [resumesLoading, setResumesLoading] = useState(true)
  const [isOnline, setIsOnline] = useState(false)

  useEffect(() => {
    loadData()

    async function loadData() {
      try {
        const user = await getCurrentUser()
        let onlineResumes: Resume[] = []

        if (user) {
          setIsOnline(true)
          const rawOnlineResumes = await getAllResumesFromUser()
          onlineResumes = rawOnlineResumes.map(r => ({ ...r, isOffline: false }))
        }

        const localResumes = await getAllOfflineResumes()
        const offlineResumes = localResumes.map(r => ({
          resume_id: r.resume_id,
          created_at: r.created_at,
          updated_at: r.updated_at,
          type: r.type as ResumeType,
          display_name: r.display_name,
          description: r.description,
          isOffline: true,
        }))

        setResumes([...onlineResumes, ...offlineResumes])
      }
      finally {
        setResumesLoading(false)
      }
    }
  }, [])

  const stats = useMemo(() => {
    const total = resumes.length
    const online = resumes.filter(r => !r.isOffline).length
    const offline = resumes.filter(r => r.isOffline).length

    // 最近7天创建的简历数
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const recentCount = resumes.filter(
      r => new Date(r.created_at) > sevenDaysAgo,
    ).length

    // 最近更新的简历
    const sortedByDate = [...resumes].sort(
      (a, b) => diffDates(b.updated_at, a.updated_at),
    )
    const latestResume = sortedByDate[0]

    return { total, online, offline, recentCount, latestResume }
  }, [resumes])

  return (
    <motion.div
      variants={Container}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-5 md:gap-6 p-4 pb-8 md:p-6 lg:p-8 max-w-7xl mx-auto"
    >
      <motion.div variants={MotionItem}>
        <Header />
      </motion.div>

      <motion.div variants={MotionItem}>
        <TodoCard />
      </motion.div>

      <motion.div variants={MotionItem}>
        <StatisticalCard stats={stats} loading={resumesLoading} />
      </motion.div>

      <motion.div variants={MotionItem}>
        <Entry isOnline={isOnline} resumes={resumes} loading={resumesLoading} />
      </motion.div>

      <motion.div variants={MotionItem}>
        <Charts stats={stats} resumes={resumes} loading={resumesLoading} />
      </motion.div>
    </motion.div>
  )
}
