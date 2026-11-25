import { useMemo } from 'react'
import { jobContextUrl } from '@/lib/job-context-url'
import type { DashboardAction } from './types'
import type { DashboardInsights } from './types'
import type { DashboardResources } from './types'

// 聚合 job / ats 概览，供统计卡与今日待办共用。
export function useDashboardInsights(
  cloudCount: number | undefined,
  resources: DashboardResources,
): DashboardInsights {
  const {
    data: jobs,
    hasLoaded: jobsReady,
    loading: jobsLoading,
  } = resources.jobs

  const { data: ats, hasLoaded: atsReady, loading: atsLoading } = resources.ats

  return useMemo(() => {
    const hasCloudResume = cloudCount !== undefined && cloudCount > 0

    const resumesWithoutAts =
      atsReady && hasCloudResume
        ? Math.max(0, cloudCount - ats.atsResumeCount)
        : 0

    const savedToApply = jobs.stages.saved ?? 0

    const actions: DashboardAction[] = []

    if (jobs.firstPendingId && jobs.pending > 0) {
      actions.push({
        id: 'pending',
        count: jobs.pending,
        label: '个岗位待跟进',
        hint: '有岗位到期或长时间未推进',
        tone: 'urgent',
        to: jobContextUrl('/tracker', jobs.firstPendingId, {
          tab: 'follow-up',
        }),
      })
    }
    if (ats.atsTodoTotal > 0) {
      actions.push({
        id: 'ats-todo',
        count: ats.atsTodoTotal,
        label: '项简历优化待完成',
        hint: 'ATS 检测给出的改进建议',
        tone: 'warning',
        to: '/optimize',
      })
    }
    if (savedToApply > 0) {
      actions.push({
        id: 'to-apply',
        count: savedToApply,
        label: '个收藏岗位待投递',
        tone: 'info',
        to: '/tracker',
      })
    }
    if (resumesWithoutAts > 0) {
      actions.push({
        id: 'no-ats',
        count: resumesWithoutAts,
        label: '份简历还没做 ATS 检测',
        tone: 'muted',
        to: '/optimize',
      })
    }

    return {
      funnel: {
        applied: jobs.applied,
        interview: jobs.stages.interview ?? 0,
        offer: jobs.stages.offer ?? 0,
        avgAtsScore: ats.avgAtsScore,
        atsResumeCount: ats.atsResumeCount,
        scoredResumeCount: ats.scoredResumeCount,
      },
      actions,
      hasCloudResume,
      loading:
        (!jobsReady && jobsLoading) ||
        (!atsReady && atsLoading) ||
        cloudCount === undefined,
      jobsLoading: !jobsReady && jobsLoading,
      atsLoading: !atsReady && atsLoading,
    }
  }, [jobs, jobsReady, jobsLoading, ats, atsReady, atsLoading, cloudCount])
}
