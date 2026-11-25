import { jobContextUrl } from '@/lib/job-context-url'
import { useMemo } from 'react'
import { formatRelativeTime } from '@/utils/date'
import type { DashboardResources } from './types'
import type { TimelineEvent } from './types'
import type { DashboardTimeline } from './types'

export function useDashboardTimeline(
  resources: DashboardResources,
): DashboardTimeline {
  const {
    data: versionSummaries,
    loading: versionsLoading,
    hasLoaded: versionsReady,
  } = resources.versions

  const {
    data: jobs,
    loading: jobsLoading,
    hasLoaded: jobsReady,
  } = resources.jobs

  return useMemo(() => {
    const events: Omit<TimelineEvent, 'time'>[] = []

    for (const version of versionSummaries) {
      const resumeName = version.resume.display_name || '未命名简历'
      const isAi = version.source_type === 'ai_optimize'

      events.push({
        id: `version-${version.resume_id}-${version.version_no}`,
        type: isAi ? 'ai' : 'edit',
        title: isAi
          ? `AI 助手更新了《${resumeName}》`
          : `编辑了《${resumeName}》`,
        timestamp: new Date(version.created_at).getTime(),
        to: '/resume/editor?resumeId=' + encodeURIComponent(version.resume_id),
      })
    }

    // 两个来源都按时间倒序，各取前五足以确定合并后的最近五条。
    for (const job of jobs.recent) {
      const target =
        [job.company, job.position].filter(Boolean).join(' · ') || '一个岗位'

      events.push({
        id: `job-${job.id}`,
        type: 'apply',
        title: `更新了岗位「${target}」`,
        timestamp: new Date(job.updated_at).getTime(),
        to: jobContextUrl('/tracker', job.id),
      })
    }

    events.sort((a, b) => b.timestamp - a.timestamp)

    return {
      events: events.slice(0, 5).map((event) => ({
        ...event,
        time: formatRelativeTime(new Date(event.timestamp)),
      })),
      loading:
        (!jobsReady && jobsLoading) || (!versionsReady && versionsLoading),
    }
  }, [
    jobs,
    jobsLoading,
    jobsReady,
    versionSummaries,
    versionsLoading,
    versionsReady,
  ])
}
