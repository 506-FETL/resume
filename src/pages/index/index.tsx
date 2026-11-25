import type { MouseEvent } from 'react'
import type { Resume } from './types'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AnimatedContent from '@/components/motion/animated-content'
import { PageLayout } from '@/components/layout/page-layout'
import { Button } from '@/components/ui/button'
import { RecentResumesSkeleton } from './components/skeleton'
import { DashboardPageSkeleton } from '@/components/page-skeletons/dashboard'
import useUserStore from '@/store/user'
import CreateResumeCard from '@/pages/resume/components/create-resume-card'
import RecentResumeCard from './components/recent-resume-card'
import Entry from './components/entry'
import Header from './components/header'
import GettingStarted from './components/getting-started'
import ImportDraftNotice from './components/import-draft'
import { useDashboardMode } from './hooks/use-dashboard-mode'
import {
  ActivityCard,
  AtsTrendCard,
  FunnelCard,
} from './components/insight-cards'
import JobPriorities from './components/job-priorities'
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
  const user = useUserStore((state) => state.currentUser)
  const authStatus = useUserStore((state) => state.authStatus)
  const navigate = useNavigate()
  const [createOpen, setCreateOpen] = useState(false)
  const createTriggerRef = useRef<HTMLElement | null>(null)

  function openCreate(event: MouseEvent<HTMLButtonElement>) {
    createTriggerRef.current = event.currentTarget
    setCreateOpen(true)
  }

  const loadData = useIndexStore((s) => s.loadData)
  const retrySource = useIndexStore((s) => s.retrySource)
  const accountId = useIndexStore((s) => s.accountId)
  const cloudState = useIndexStore((s) => s.cloud)
  const localState = useIndexStore((s) => s.local)

  const accountMatches =
    authStatus !== 'unknown' && accountId === (user?.id ?? null)

  const recentResumes = useMemo(() => {
    if (!accountMatches) return EMPTY_RESUMES

    return [...cloudState.items, ...localState.items]
      .sort(
        (a, b) =>
          (Date.parse(b.updated_at || b.created_at) || 0) -
          (Date.parse(a.updated_at || a.created_at) || 0),
      )
      .slice(0, 2)
  }, [accountMatches, cloudState.items, localState.items])

  const isOnline = Boolean(user)
  const cloudHasLoaded = accountMatches && cloudState.hasLoaded
  const resumeCount = accountMatches ? cloudState.total + localState.total : 0
  const resumeError = accountMatches && (cloudState.error || localState.error)

  const cloudUnavailable =
    accountMatches && Boolean(cloudState.error) && !cloudHasLoaded

  const resumesLoading =
    !accountMatches ||
    (cloudState.loading && !cloudState.hasLoaded) ||
    (localState.loading && !localState.hasLoaded)

  const resources = useDashboardResources(
    authStatus !== 'unknown',
    isOnline,
    user?.id,
  )

  const insights = useDashboardInsights(
    cloudHasLoaded ? cloudState.total : undefined,
    resources,
  )

  const extras = useDashboardExtras(resources)
  const timeline = useDashboardTimeline(resources)

  const mode = useDashboardMode({
    accountMatches,
    resumeCount,
    resumesConfirmedEmpty:
      accountMatches &&
      cloudState.hasLoaded &&
      localState.hasLoaded &&
      !cloudState.loading &&
      !localState.loading &&
      !resumeError,
    jobsCount: resources.jobs.data.total,
    jobsConfirmedEmpty:
      resources.jobs.hasLoaded &&
      !resources.jobs.loading &&
      !resources.jobs.error,
  })

  const isGettingStarted = mode === 'guest' || mode === 'onboarding'

  const showRecentResumes =
    !isGettingStarted ||
    recentResumes.length > 0 ||
    resumesLoading ||
    Boolean(resumeError)

  useEffect(() => {
    if (authStatus === 'unknown') return

    loadData()

    return useIndexStore.getState().leavePage
  }, [loadData, user?.id, authStatus])

  return (
    <PageLayout>
      <div className='flex min-w-0 flex-col gap-8'>
        <div>
          <Header onCreate={openCreate} createDisabled={mode === 'pending'} />
        </div>

        <AnimatedContent key={user?.id ?? 'guest'} animationKey={mode}>
          <div className='flex min-w-0 flex-col gap-8'>
            {mode === 'pending' ? (
              <DashboardPageSkeleton contentOnly />
            ) : (
              <>
                <ImportDraftNotice onResume={openCreate} />
                {isGettingStarted && (
                  <GettingStarted
                    isAuthenticated={isOnline}
                    hasResume={recentResumes.length > 0}
                    onCreate={openCreate}
                  />
                )}
                {showRecentResumes && (
                  <section
                    className='flex flex-col gap-3'
                    aria-labelledby='recent-resumes-title'
                  >
                    <div className='flex items-center justify-between gap-3'>
                      <h2
                        id='recent-resumes-title'
                        className='text-base font-semibold'
                      >
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
                    <AnimatedContent
                      animationKey={
                        recentResumes.length
                          ? 'resumes'
                          : resumesLoading
                            ? 'loading'
                            : 'empty'
                      }
                    >
                      {resumesLoading && recentResumes.length === 0 ? (
                        <RecentResumesSkeleton />
                      ) : recentResumes.length === 0 ? (
                        <p className='rounded-lg border p-4 text-sm text-muted-foreground'>
                          {resumeError
                            ? '暂时无法加载简历'
                            : '还没有简历，点击“创建简历”开始填写。'}
                        </p>
                      ) : (
                        <div className='grid gap-3 md:grid-cols-2'>
                          {recentResumes.map((resume) => (
                            <RecentResumeCard
                              key={`${accountId ?? 'guest'}:${resume.isOffline ? 'local' : 'cloud'}:${resume.resume_id}:${resume.updated_at}`}
                              resume={resume}
                            />
                          ))}
                        </div>
                      )}
                    </AnimatedContent>
                    {accountMatches && cloudState.error && (
                      <ResourceError
                        label='云端简历'
                        hasLoaded={cloudState.hasLoaded}
                        retry={() => retrySource('cloud')}
                      />
                    )}
                    {accountMatches && localState.error && (
                      <ResourceError
                        label='本地简历'
                        hasLoaded={localState.hasLoaded}
                        retry={() => retrySource('local')}
                      />
                    )}
                  </section>
                )}
                {mode === 'workspace' && (
                  <>
                    <div>
                      <JobPriorities resources={resources} />
                    </div>
                    <div className='flex flex-col gap-2 empty:hidden'>
                      {Object.entries(resources).map(
                        ([key, resource]) =>
                          resource.error && (
                            <ResourceError
                              key={key}
                              label={
                                {
                                  jobs: '岗位',
                                  ats: 'ATS 检测',
                                  trend: 'ATS 分数趋势',
                                  versions: '版本动态',
                                  weeklyEdits: '本周编辑次数',
                                }[key] ?? key
                              }
                              hasLoaded={resource.hasLoaded}
                              retry={resource.retry}
                            />
                          ),
                      )}
                    </div>
                    <div className='grid min-w-0 items-start gap-6 lg:grid-cols-2'>
                      <div className='min-w-0 self-stretch'>
                        <TodoCard
                          unavailable={
                            cloudUnavailable ||
                            Boolean(
                              (resources.jobs.error &&
                                !resources.jobs.hasLoaded) ||
                              (resources.ats.error && !resources.ats.hasLoaded),
                            )
                          }
                          actions={insights.actions}
                          loading={insights.loading}
                          isAuthenticated={isOnline}
                          hasCloudResume={insights.hasCloudResume}
                        />
                      </div>
                      <div className='min-w-0'>
                        <StatisticalCard
                          funnel={insights.funnel}
                          jobsLoading={insights.jobsLoading}
                          atsLoading={insights.atsLoading}
                          jobsUnavailable={Boolean(
                            resources.jobs.error && !resources.jobs.hasLoaded,
                          )}
                          atsUnavailable={Boolean(
                            resources.ats.error && !resources.ats.hasLoaded,
                          )}
                        />
                      </div>
                    </div>
                    <div className='grid min-w-0 items-start gap-6 lg:grid-cols-3'>
                      <FunnelCard
                        funnel={extras.funnel}
                        loading={extras.funnelLoading}
                        unavailable={Boolean(
                          resources.jobs.error && !resources.jobs.hasLoaded,
                        )}
                      />
                      <AtsTrendCard
                        trend={extras.atsTrend}
                        loading={extras.atsTrendLoading}
                        unavailable={Boolean(
                          resources.trend.error && !resources.trend.hasLoaded,
                        )}
                      />
                      <ActivityCard
                        activity={extras.activity}
                        loading={extras.activityLoading}
                        edits={resources.weeklyEdits}
                        jobs={resources.jobs}
                      />
                    </div>
                    <div className='min-w-0'>
                      <Entry
                        unavailable={Boolean(
                          (resources.jobs.error && !resources.jobs.hasLoaded) ||
                          (resources.versions.error &&
                            !resources.versions.hasLoaded),
                        )}
                        onCreate={openCreate}
                        events={timeline.events}
                        timelineLoading={timeline.loading}
                        resumeCount={
                          cloudHasLoaded && localState.hasLoaded
                            ? resumeCount
                            : undefined
                        }
                      />
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </AnimatedContent>
      </div>
      <CreateResumeCard
        returnFocusRef={createTriggerRef}
        hideTrigger
        open={createOpen}
        onOpenChange={setCreateOpen}
        online={isOnline}
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
