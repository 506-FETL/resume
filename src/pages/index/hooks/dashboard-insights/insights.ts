import { useMemo } from 'react'
import { jobContextUrl } from '@/lib/job-context-url'
import { isJobPendingFollowUp } from '@/pages/tracker/utils/follow-up'
import type { DashboardAction } from './types'
import type { DashboardInsights } from './types'
import type { DashboardResources } from './types'

// 聚合 job / ats 概览，供统计卡与今日待办共用。
export function useDashboardInsights(
  cloudCount: number,
  resumesLoading: boolean,
  resources: DashboardResources,
): DashboardInsights {
  const { data: jobSummaries, loading: jobsResourceLoading } = resources.jobs
  const { data: atsSummaries, loading: atsResourceLoading } = resources.ats

  return useMemo(() => {
    const hasCloudResume = cloudCount > 0
    const jobsLoading = jobsResourceLoading
    const atsLoading = atsResourceLoading

    // 求职漏斗：越过 saved 即视为已投递；面试/Offer 仅统计未归档的在办岗位
    const applied = jobSummaries.filter((job) => job.status !== 'saved').length

    const interview = jobSummaries.filter(
      (job) => !job.archived && job.status === 'interview',
    ).length

    const offer = jobSummaries.filter(
      (job) => !job.archived && job.status === 'offer',
    ).length

    const pending = jobSummaries.filter(isJobPendingFollowUp).length

    const savedToApply = jobSummaries.filter(
      (job) => !job.archived && job.status === 'saved',
    ).length

    const scored = atsSummaries
      .map((report) => report.overall_score)
      .filter((score): score is number => typeof score === 'number')

    const avgAtsScore =
      scored.length > 0
        ? Math.round(
            scored.reduce((sum, score) => sum + score, 0) / scored.length,
          )
        : null

    const atsTodoTotal = atsSummaries.reduce(
      (sum, summary) => sum + summary.pending_count,
      0,
    )

    const resumesWithoutAts = cloudCount - atsSummaries.length

    const actions: DashboardAction[] = []

    if (pending > 0) {
      actions.push({
        id: 'pending',
        count: pending,
        label: '个岗位待跟进',
        hint: '有岗位到期或长时间未推进',
        tone: 'urgent',
        to: jobContextUrl(
          '/tracker',
          jobSummaries.find(isJobPendingFollowUp)!.id,
          { tab: 'follow-up' },
        ),
      })
    }
    if (atsTodoTotal > 0) {
      actions.push({
        id: 'ats-todo',
        count: atsTodoTotal,
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
        applied,
        interview,
        offer,
        avgAtsScore,
        atsResumeCount: atsSummaries.length,
      },
      actions: hasCloudResume ? actions : [],
      hasCloudResume,
      loading:
        resumesLoading || (hasCloudResume && (jobsLoading || atsLoading)),
      jobsLoading,
      atsLoading,
    }
  }, [
    atsResourceLoading,
    atsSummaries,
    jobSummaries,
    jobsResourceLoading,
    cloudCount,
    resumesLoading,
  ])
}
