import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { JdVariantDialog } from '@/components/jd-variant/jd-variant-dialog'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import useResumeListStore from '@/pages/resume/store'
import useCurrentResumeStore from '@/store/resume/current'
import CreateResumeCard from './components/create-resume-card'
import HeadBars from './components/head-bars'
import ResumeCard from './components/resume-card'
import SyncResumesDialog from './components/sync-resumes-dialog'

export default function ResumePage() {
  const {
    resumes,
    loading,
    isOnline,
    syncingIds,
    loadResumes,
    setupRealtimeSubscription,
    filterMode,
    setFilterMode,
    derivePendingFor,
    openDeriveFor,
  } = useResumeListStore()
  const { setCurrentResume } = useCurrentResumeStore()
  const navigate = useNavigate()

  useEffect(() => {
    loadResumes()
  }, [loadResumes])

  useEffect(() => {
    if (!isOnline)
      return

    return setupRealtimeSubscription()
  }, [isOnline, setupRealtimeSubscription])

  const visibleItems = useMemo(() => {
    if (filterMode === 'roots')
      return resumes.filter(r => !r.parent_resume_id)
    if (filterMode === 'variants')
      return resumes.filter(r => r.parent_resume_id && r.derived_status === 'ready')
    return resumes
  }, [resumes, filterMode])

  const pendingResume = useMemo(
    () => (derivePendingFor ? resumes.find(r => r.resume_id === derivePendingFor) ?? null : null),
    [derivePendingFor, resumes],
  )

  if (loading)
    return <ResumePageSkeleton />

  return (
    <div className="container mx-auto p-8">
      <HeadBars />

      <Tabs
        value={filterMode}
        onValueChange={v => setFilterMode(v as 'all' | 'roots' | 'variants')}
        className="mb-6"
      >
        <TabsList>
          <TabsTrigger value="all">全部</TabsTrigger>
          <TabsTrigger value="roots">原版</TabsTrigger>
          <TabsTrigger value="variants">派生版本</TabsTrigger>
        </TabsList>
      </Tabs>

      <motion.div
        className="grid grid-cols-1 items-center md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <AnimatePresence mode="popLayout">
          {visibleItems.map((resume, index) => {
            const isSyncingThis = syncingIds.has(resume.resume_id)
            return (
              <motion.div
                key={resume.resume_id}
                layout
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{
                  opacity: isSyncingThis ? 0.5 : 1,
                  scale: isSyncingThis ? 0.95 : 1,
                  y: 0,
                }}
                exit={{
                  opacity: 0,
                  scale: 0.8,
                  y: -20,
                  transition: { duration: 0.2 },
                }}
                transition={{
                  duration: 0.3,
                  delay: index * 0.05,
                  layout: { duration: 0.3 },
                }}
              >
                <ResumeCard resume={resume} />
              </motion.div>
            )
          })}

          <motion.div
            key="create-card"
            layout
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{
              duration: 0.3,
              delay: visibleItems.length * 0.05,
              layout: { duration: 0.3 },
            }}
          >
            <CreateResumeCard />
          </motion.div>
        </AnimatePresence>
      </motion.div>

      <SyncResumesDialog />

      {derivePendingFor && (
        <JdVariantDialog
          open
          onOpenChange={(o) => {
            if (!o)
              openDeriveFor(null)
          }}
          parentResumeId={derivePendingFor}
          recentJds={[]}
          initialJd={pendingResume?.linked_jd_text ?? ''}
          onOpenResume={(draftId) => {
            const target = resumes.find(r => r.resume_id === draftId)
            setCurrentResume(draftId, target?.type ?? 'default')
            navigate('/resume/editor')
          }}
        />
      )}
    </div>
  )
}

function ResumePageSkeleton() {
  return (
    <div className="container mx-auto p-8">
      <motion.div
        className="mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Skeleton className="h-9 w-48 mb-2" />
        <Skeleton className="h-5 w-64" />
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 8 }, (_, idx) => idx).map(i => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between mb-4">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
