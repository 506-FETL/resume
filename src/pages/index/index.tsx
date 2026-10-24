import type { MouseEvent } from 'react'
import type { Resume } from './types'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageLayout } from '@/components/layout/page-layout'
import { Button } from '@/components/ui/button'
import useCurrentUser from '@/hooks/use-current-user'
import { DURATION, EASE } from '@/lib/motion'
import CreateResumeCard from '@/pages/resume/components/create-resume-card'
import useCurrentResumeStore from '@/store/resume/current'
import Entry from './components/entry'
import Header from './components/header'
import {
  ActivityCard,
  AtsTrendCard,
  FollowUpCard,
  FunnelCard,
} from './components/insight-cards'
import StatisticalCard from './components/statistical-card'
import { TodoCard } from './components/todo'
import {
  useDashboardExtras,
  useDashboardInsights,
  useDashboardResources,
  useDashboardTimeline,
} from './insights'
import useIndexStore from './store'

const EMPTY_RESUMES: Resume[] = []

export default function DashboardPage() {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const [createOpen, setCreateOpen] = useState(false)
  const createTriggerRef = useRef<HTMLElement | null>(null)

  function openCreate(event: MouseEvent<HTMLButtonElement>) {
    createTriggerRef.current = event.currentTarget
    setCreateOpen(true)
  }

  const reduceMotion = useReducedMotion()

  const container = {
    hidden: { opacity: 1 },
    show: {
      opacity: 1,
      transition: { staggerChildren: reduceMotion ? 0 : 0.03 },
    },
  }

  const item = {
    hidden: { opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 8 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: reduceMotion ? 0 : DURATION.base,
        ease: EASE.out,
      },
    },
  }

  const loadData = useIndexStore((s) => s.loadData)
  const rawResumes = useIndexStore((s) => s.resumes)
  const accountId = useIndexStore((s) => s.accountId)
  const accountMatches = accountId === (user?.id ?? null)
  const resumes = accountMatches ? rawResumes : EMPTY_RESUMES
  const storeLoading = useIndexStore((s) => s.loading)
  const resumesLoading = !accountMatches || storeLoading
  const storeError = useIndexStore((s) => s.error)
  const resumeError = accountMatches ? storeError : null
  const isOnline = Boolean(user)
  const cloudState = useIndexStore((s) => s.cloud)
  const localState = useIndexStore((s) => s.local)
  const cloudHasLoaded = accountMatches && cloudState.hasLoaded

  const cloudUnavailable =
    accountMatches && Boolean(cloudState.error) && !cloudHasLoaded

  const cloudPending =
    !accountMatches || (cloudState.loading && !cloudHasLoaded)

  const resources = useDashboardResources(
    !resumesLoading || isOnline,
    isOnline,
    user?.id,
  )

  // 云端派生模块只等待云端列表，本地失败或慢请求不会阻塞其可用数据。
  const insights = useDashboardInsights(resumes, cloudPending, resources)
  const extras = useDashboardExtras(resumes, cloudPending, resources)
  const timeline = useDashboardTimeline(resumes, cloudPending, resources)

  useEffect(() => {
    loadData()

    return () => useIndexStore.getState().cancelLoad()
  }, [loadData, user?.id])

  return (
    <PageLayout>
      <motion.div
        variants={container}
        initial='hidden'
        animate='show'
        className='flex flex-col gap-6'
      >
        <motion.div variants={item}>
          <Header onCreate={openCreate} />
        </motion.div>

        <motion.section
          variants={item}
          className='flex flex-col gap-3'
          aria-labelledby='recent-resumes-title'
        >
          <div className='flex items-center justify-between gap-3'>
            <h2 id='recent-resumes-title' className='text-base font-semibold'>
              最近简历
            </h2>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => navigate('/resume')}
            >
              查看全部
            </Button>
          </div>
          {resumesLoading && resumes.length === 0 ? (
            <p className='text-sm text-muted-foreground' role='status'>
              正在加载简历…
            </p>
          ) : resumes.length === 0 ? (
            <p className='rounded-xl border p-4 text-sm text-muted-foreground'>
              {resumeError
                ? '— 暂时无法加载简历'
                : '从第一份简历开始，整理你的下一次机会。'}
            </p>
          ) : (
            <div className='grid gap-3 md:grid-cols-2'>
              {[...resumes]
                .sort(
                  (a, b) =>
                    new Date(b.updated_at || b.created_at).getTime() -
                    new Date(a.updated_at || a.created_at).getTime(),
                )
                .slice(0, 2)
                .map((resume) => (
                  <div
                    key={resume.resume_id}
                    className='flex min-w-0 items-center justify-between gap-3 rounded-xl border bg-card p-4'
                  >
                    <div className='min-w-0'>
                      <h3 className='truncate text-sm font-medium'>
                        {resume.display_name || '未命名简历'}
                      </h3>
                      <p className='mt-1 text-xs text-muted-foreground'>
                        {resume.isOffline ? '本地' : '云端'} ·{' '}
                        {new Date(
                          resume.updated_at || resume.created_at,
                        ).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      size='sm'
                      onClick={() => {
                        useCurrentResumeStore
                          .getState()
                          .setCurrentResume(resume.resume_id, resume.type)

                        navigate('/resume/editor')
                      }}
                    >
                      继续编辑
                    </Button>
                  </div>
                ))}
            </div>
          )}
          {accountMatches && cloudState.error && (
            <ResourceError
              label='云端简历'
              hasLoaded={cloudState.hasLoaded}
              retry={loadData}
            />
          )}
          {accountMatches && localState.error && (
            <ResourceError
              label='本地简历'
              hasLoaded={localState.hasLoaded}
              retry={loadData}
            />
          )}
          {resumeError && !cloudState.error && !localState.error && (
            <ResourceError
              label='简历'
              hasLoaded={resumes.length > 0}
              retry={loadData}
            />
          )}
        </motion.section>
        <div className='flex flex-col gap-2 empty:hidden'>
          {Object.entries(resources).map(
            ([key, resource]) =>
              resource.error && (
                <ResourceError
                  key={key}
                  label={
                    { jobs: '岗位', ats: 'ATS 检测', versions: '版本动态' }[
                      key
                    ] ?? key
                  }
                  hasLoaded={resource.hasLoaded}
                  retry={resource.retry}
                />
              ),
          )}
        </div>
        <motion.div variants={item}>
          <TodoCard
            unavailable={
              cloudUnavailable ||
              Boolean(
                (resources.jobs.error && !resources.jobs.hasLoaded) ||
                (resources.ats.error && !resources.ats.hasLoaded),
              )
            }
            actions={insights.actions}
            loading={insights.loading}
            isAuthenticated={isOnline}
            hasCloudResume={insights.hasCloudResume}
          />
        </motion.div>

        <AnimatePresence initial={false}>
          {!extras.followUpsLoading && extras.followUps.length > 0 && (
            <motion.div
              key='follow-ups'
              initial={{
                opacity: reduceMotion ? 1 : 0,
                height: reduceMotion ? 'auto' : 0,
              }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{
                opacity: 0,
                height: 0,
                transition: {
                  duration: reduceMotion ? 0 : DURATION.fast,
                  ease: EASE.in,
                },
              }}
              transition={{
                duration: reduceMotion ? 0 : DURATION.base,
                ease: EASE.out,
              }}
              className='overflow-hidden'
            >
              <FollowUpCard
                followUps={extras.followUps}
                total={extras.followUpTotal}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div variants={item}>
          <StatisticalCard
            funnel={insights.funnel}
            jobsLoading={insights.jobsLoading}
            atsLoading={insights.atsLoading}
            jobsUnavailable={Boolean(
              resources.jobs.error && !resources.jobs.hasLoaded,
            )}
            atsUnavailable={
              cloudUnavailable ||
              Boolean(resources.ats.error && !resources.ats.hasLoaded)
            }
          />
        </motion.div>

        <motion.div
          variants={item}
          className='grid gap-4 grid-cols-1 md:gap-5 md:grid-cols-2'
        >
          {(!resources.jobs.error || resources.jobs.hasLoaded) && (
            <FunnelCard funnel={extras.funnel} loading={extras.funnelLoading} />
          )}
          {!cloudUnavailable &&
            (!resources.ats.error || resources.ats.hasLoaded) && (
              <AtsTrendCard
                trend={extras.atsTrend}
                loading={extras.atsTrendLoading}
              />
            )}
        </motion.div>

        <motion.div variants={item}>
          {!cloudUnavailable &&
            (!resources.jobs.error || resources.jobs.hasLoaded) &&
            (!resources.versions.error || resources.versions.hasLoaded) && (
              <ActivityCard
                activity={extras.activity}
                loading={extras.activityLoading}
              />
            )}
        </motion.div>

        <motion.div variants={item}>
          <Entry
            unavailable={
              cloudUnavailable ||
              Boolean(
                (resources.jobs.error && !resources.jobs.hasLoaded) ||
                (resources.versions.error && !resources.versions.hasLoaded),
              )
            }
            onCreate={openCreate}
            events={timeline.events}
            timelineLoading={timeline.loading}
            resumeCount={
              cloudHasLoaded && localState.hasLoaded
                ? resumes.length
                : undefined
            }
          />
        </motion.div>
      </motion.div>
      <CreateResumeCard
        returnFocusRef={createTriggerRef}
        hideTrigger
        open={createOpen}
        onOpenChange={setCreateOpen}
        online={isOnline}
        onCreated={loadData}
      />
    </PageLayout>
  )
}

function ResourceError({
  label,
  hasLoaded,
  retry,
}: {
  label: string
  hasLoaded: boolean
  retry: () => void
}) {
  return (
    <div
      role='status'
      className='flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm'
    >
      <span className='text-muted-foreground'>
        {label}：{hasLoaded ? '刷新失败，保留上次数据' : '— 加载失败'}
      </span>
      <Button size='sm' variant='ghost' onClick={retry}>
        重试
      </Button>
    </div>
  )
}
