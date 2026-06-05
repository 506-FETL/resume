import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { JdVariantDialog } from '@/components/jd-variant/components/generator-dialog'
import { DerivedJobsDialog } from '@/components/jd-variant/components/tasks-dialog'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import useResumeListStore from '@/pages/resume/store'
import useCurrentResumeStore from '@/store/resume/current'
import CreateResumeCard from './components/create-resume-card'
import HeadBars from './components/head-bars'
import ResumeCard from './components/resume-card'
import SyncResumesDialog from './components/sync-resumes-dialog'

export default function ResumePage() {
  const { resumes, loading, isOnline, syncingIds, loadResumes, setupRealtimeSubscription, filterMode, setFilterMode, derivePendingFor, openDeriveFor, derivedJobsOpen, setDerivedJobsOpen } = useResumeListStore()
  const { setCurrentResume } = useCurrentResumeStore()
  const navigate = useNavigate()
  const shouldReduceMotion = useReducedMotion()
  const retainedDeriveParentId = useRef<string | null>(derivePendingFor)
  if (derivePendingFor) {
    retainedDeriveParentId.current = derivePendingFor
  }
  const deriveDialogParentId = derivePendingFor ?? retainedDeriveParentId.current

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
    <div className="container mx-auto flex flex-col gap-3 px-4 py-6 sm:px-6 lg:px-8">
      <HeadBars />

      <Tabs
        value={filterMode}
        onValueChange={v => setFilterMode(v as 'all' | 'roots' | 'variants')}
        className="my-3"
      >
        <TabsList>
          <TabsTrigger value="all">全部</TabsTrigger>
          <TabsTrigger value="roots">原版</TabsTrigger>
          <TabsTrigger value="variants">派生版本</TabsTrigger>
        </TabsList>
      </Tabs>

      <motion.div
        className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.18 }}
      >
        <AnimatePresence mode="popLayout">
          {visibleItems.map((resume) => {
            const isSyncingThis = syncingIds.has(resume.resume_id)
            return (
              <motion.div
                key={resume.resume_id}
                layout
                initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 8 }}
                animate={{
                  opacity: isSyncingThis ? 0.55 : 1,
                  y: 0,
                }}
                exit={{
                  opacity: 0,
                  y: shouldReduceMotion ? 0 : -4,
                }}
                transition={{
                  duration: shouldReduceMotion ? 0 : 0.18,
                  ease: 'easeOut',
                  layout: { duration: shouldReduceMotion ? 0 : 0.2 },
                }}
              >
                <ResumeCard resume={resume} />
              </motion.div>
            )
          })}

          <motion.div
            key="create-card"
            layout
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: shouldReduceMotion ? 0 : 0.18,
              ease: 'easeOut',
              layout: { duration: shouldReduceMotion ? 0 : 0.2 },
            }}
          >
            <CreateResumeCard />
          </motion.div>
        </AnimatePresence>
      </motion.div>

      <SyncResumesDialog />

      <DerivedJobsDialog open={derivedJobsOpen} onOpenChange={setDerivedJobsOpen} />

      {deriveDialogParentId && (
        <JdVariantDialog
          key={deriveDialogParentId}
          open={Boolean(derivePendingFor)}
          onOpenChange={(o) => {
            if (!o)
              openDeriveFor(null)
          }}
          parentResumeId={deriveDialogParentId}
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
    <div className="container mx-auto flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-64" />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, idx) => idx).map(i => (
          <Card key={i} className="gap-5 py-5">
            <CardHeader className="flex flex-col gap-4 px-5">
              <div className="flex items-center justify-between gap-4">
                <Skeleton className="size-10 rounded-lg" />
                <Skeleton className="h-4 w-20" />
              </div>
              <div className="flex flex-col gap-2">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </CardHeader>
            <CardContent className="px-5">
              <Skeleton className="h-16 w-full" />
            </CardContent>
            <CardFooter className="grid grid-cols-2 gap-2 px-5">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}
