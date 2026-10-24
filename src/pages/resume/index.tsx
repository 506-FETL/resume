import type { MouseEvent } from 'react'
import type { ResumeItem } from './types'
import { Plus } from 'lucide-react'
import { AnimatePresence, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { JdVariantDialog } from '@/components/jd-variant/components/generator-dialog'
import { DerivedJobsDialog } from '@/components/jd-variant/components/tasks-dialog'
import { PageLayout } from '@/components/layout/page-layout'
import AnimatedContent from '@/components/motion/animated-content'
import { PresenceDiv } from '@/components/motion/presence-item'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import useCurrentUser from '@/hooks/use-current-user'
import { DURATION, EASE, SPRING, staggerDelay } from '@/lib/motion'
import { getResumeSnapshotById } from '@/lib/supabase/resume/share'
import useResumeListStore from '@/pages/resume/store'
import QuickDialog from '@/pages/share/components/quick-dialog'
import useShareStore from '@/pages/share/store'
import useCurrentResumeStore from '@/store/resume/current'
import CreateResumeCard from './components/create-resume-card'
import HeadBars from './components/head-bars'
import ResumeCard from './components/resume-card'
import SyncResumesDialog from './components/sync-resumes-dialog'

const EMPTY_RESUMES: ResumeItem[] = []

export default function ResumePage() {
  const user = useCurrentUser()
  const [createOpen, setCreateOpen] = useState(false)
  const createTriggerRef = useRef<HTMLElement | null>(null)

  function openCreate(event: MouseEvent<HTMLButtonElement>) {
    createTriggerRef.current = event.currentTarget
    setCreateOpen(true)
  }

  const {
    accountId,
    loadError: storeError,
    resumes: rawResumes,
    loading: storeLoading,
    offlineResumes,
    syncingIds,
    loadResumes,
    setupRealtimeSubscription,
    filterMode,
    setFilterMode,
    derivePendingFor,
    openDeriveFor,
    derivedJobsOpen,
    setDerivedJobsOpen,
  } = useResumeListStore()

  const accountMatches = accountId === (user?.id ?? null)
  const resumes = accountMatches ? rawResumes : EMPTY_RESUMES
  const loading = !accountMatches || storeLoading
  const loadError = accountMatches ? storeError : null
  const isOnline = Boolean(user)
  const { setCurrentResume } = useCurrentResumeStore()
  const { openForResumeId: shareOpenForResumeId } = useShareStore()
  const navigate = useNavigate()
  const shouldReduceMotion = useReducedMotion()
  const retainedDeriveParentId = useRef<string | null>(derivePendingFor)

  if (derivePendingFor) {
    retainedDeriveParentId.current = derivePendingFor
  }

  const deriveDialogParentId =
    derivePendingFor ?? retainedDeriveParentId.current

  useEffect(() => {
    loadResumes()

    return () => useResumeListStore.getState().cancelLoad()
  }, [loadResumes, user?.id])

  useEffect(() => {
    if (!isOnline) return

    return setupRealtimeSubscription()
  }, [isOnline, setupRealtimeSubscription, user?.id])

  const visibleItems = useMemo(() => {
    if (filterMode === 'roots')
      return resumes.filter((r) => !r.parent_resume_id)
    if (filterMode === 'variants')
      return resumes.filter(
        (r) => r.parent_resume_id && r.derived_status === 'ready',
      )

    return resumes
  }, [resumes, filterMode])

  const pendingResume = useMemo(
    () =>
      derivePendingFor
        ? (resumes.find((r) => r.resume_id === derivePendingFor) ?? null)
        : null,
    [derivePendingFor, resumes],
  )

  return (
    <AnimatedContent
      key={user?.id ?? 'offline'}
      animationKey={loading ? 'loading' : 'resumes'}
    >
      {loading ? (
        <ResumePageSkeleton />
      ) : (
        <PageLayout>
          <HeadBars
            resumes={resumes}
            isOnline={isOnline}
            offlineCount={accountMatches ? offlineResumes.length : 0}
            onCreate={openCreate}
          />
          {loadError && (
            <div
              role='status'
              className='flex items-center justify-between gap-3 rounded-lg border p-3 text-sm'
            >
              <span>
                {resumes.length ? '刷新失败，保留上次数据' : '— 简历加载失败'}
              </span>
              <Button size='sm' variant='outline' onClick={loadResumes}>
                重试
              </Button>
            </div>
          )}
          <Tabs
            value={filterMode}
            onValueChange={(v) =>
              setFilterMode(v as 'all' | 'roots' | 'variants')
            }
            className='min-w-0'
          >
            <TabsList className='max-w-full'>
              <TabsTrigger value='all'>全部</TabsTrigger>
              <TabsTrigger value='roots'>原版</TabsTrigger>
              <TabsTrigger value='variants'>派生版本</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className='grid grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-4'>
            <AnimatePresence mode='popLayout' initial={false}>
              {visibleItems.map((resume, index) => {
                const isSyncingThis = syncingIds.has(resume.resume_id)

                return (
                  <PresenceDiv
                    key={resume.resume_id}
                    className='min-w-0'
                    layout={shouldReduceMotion ? false : 'position'}
                    initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 8 }}
                    animate={{
                      opacity: isSyncingThis ? 0.55 : 1,
                      y: 0,
                      transition: {
                        duration: shouldReduceMotion ? 0 : DURATION.base,
                        ease: EASE.out,
                        delay: shouldReduceMotion
                          ? 0
                          : staggerDelay(Math.min(index, 8)),
                      },
                    }}
                    exit={{
                      opacity: 0,
                      y: shouldReduceMotion ? 0 : -4,
                      transition: {
                        duration: shouldReduceMotion ? 0 : DURATION.fast,
                        ease: EASE.in,
                      },
                    }}
                    transition={{
                      duration: shouldReduceMotion ? 0 : DURATION.base,
                      ease: EASE.out,
                      layout: shouldReduceMotion
                        ? { duration: 0 }
                        : SPRING.layout,
                    }}
                  >
                    <ResumeCard resume={resume} />
                  </PresenceDiv>
                )
              })}

              <PresenceDiv
                key='create-card'
                layout={shouldReduceMotion ? false : 'position'}
                initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: shouldReduceMotion ? 0 : DURATION.base,
                  ease: EASE.out,
                  layout: shouldReduceMotion ? { duration: 0 } : SPRING.layout,
                }}
              >
                <button
                  type='button'
                  aria-label='打开创建简历表单'
                  onClick={openCreate}
                  className='flex h-full min-h-56 w-full cursor-pointer flex-col items-center justify-center gap-6 overflow-hidden rounded-xl border-2 border-dashed bg-card py-6 text-card-foreground shadow-xs ring-1 ring-foreground/10 transition-all hover:border-primary/50 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
                  style={{
                    transitionDuration: shouldReduceMotion
                      ? '0s'
                      : `${DURATION.base}s`,
                  }}
                >
                  <span aria-hidden='true' className='flex justify-center px-6'>
                    <span className='flex size-16 shrink-0 items-center justify-center rounded-full bg-primary/10'>
                      <Plus className='size-8' />
                    </span>
                  </span>
                  <span className='flex justify-center px-6 text-lg font-semibold'>
                    创建新简历
                  </span>
                </button>
              </PresenceDiv>
            </AnimatePresence>
          </div>

          <CreateResumeCard
            online={isOnline}
            returnFocusRef={createTriggerRef}
            hideTrigger
            open={createOpen}
            onOpenChange={setCreateOpen}
          />
          <SyncResumesDialog />

          <QuickDialog
            getSnapshot={async () => {
              if (!shareOpenForResumeId) throw new Error('未选择简历')

              return getResumeSnapshotById(shareOpenForResumeId)
            }}
          />

          <DerivedJobsDialog
            open={derivedJobsOpen}
            onOpenChange={setDerivedJobsOpen}
          />

          {deriveDialogParentId && (
            <JdVariantDialog
              key={deriveDialogParentId}
              open={Boolean(derivePendingFor)}
              onOpenChange={(o) => {
                if (!o) openDeriveFor(null)
              }}
              parentResumeId={deriveDialogParentId}
              recentJds={[]}
              initialJd={pendingResume?.linked_jd_text ?? ''}
              onOpenResume={(draftId) => {
                const target = resumes.find((r) => r.resume_id === draftId)

                setCurrentResume(draftId, target?.type ?? 'default')
                navigate('/resume/editor')
              }}
            />
          )}
        </PageLayout>
      )}
    </AnimatedContent>
  )
}

function ResumePageSkeleton() {
  return (
    <PageLayout>
      <div className='flex flex-col gap-2'>
        <Skeleton className='h-9 w-48' />
        <Skeleton className='h-5 w-64' />
      </div>

      <div className='grid grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-4'>
        {Array.from({ length: 8 }, (_, idx) => idx).map((i) => (
          <Card key={i} className='min-h-56 gap-3 p-4'>
            <div className='flex items-center gap-2.5'>
              <Skeleton className='size-8 rounded-lg' />
              <div className='space-y-1.5'>
                <Skeleton className='h-3 w-16' />
                <Skeleton className='h-3 w-24' />
              </div>
            </div>
            <div className='flex-1 space-y-2'>
              <Skeleton className='h-5 w-3/4' />
              <Skeleton className='h-4 w-1/2' />
            </div>
            <div className='flex gap-2 border-t pt-3'>
              <Skeleton className='h-8 flex-1' />
              <Skeleton className='h-8 w-14' />
              <Skeleton className='h-8 w-14' />
            </div>
          </Card>
        ))}
      </div>
    </PageLayout>
  )
}
