import type { ApplicationStatus } from '@/pages/tracker/types'
import { useMemo } from 'react'
import { formatRelativeTime } from '@/utils/date'
import type { DashboardResources } from './types'
import type { TimelineEvent } from './types'
import type { DashboardTimeline } from './types'

// job 状态对应的动态文案前缀
export const APPLY_STATUS_VERB: Partial<Record<ApplicationStatus, string>> = {
  saved: '收藏了',
  applied: '投递了',
  assessment: '进入测评',
  screen: '进入初筛',
  written: '进入笔试',
  interview: '面试推进',
  offer: '收到 Offer',
  rejected: '结束了',
}

// 聚合简历版本历史 + 岗位投递，产出按时间倒序的近期事件时间线（首页「最近动态」数据源）
export function useDashboardTimeline(
  cloudCount: number,
  resumesLoading: boolean,
  resources: DashboardResources,
): DashboardTimeline {
  const { data: versionSummaries, loading: versionsLoading } =
    resources.versions

  const { data: jobSummaries, loading: jobsLoading } = resources.jobs

  return useMemo(() => {
    if (jobsLoading || ((resumesLoading || cloudCount > 0) && versionsLoading))
      return { events: [], loading: true }

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
        to: '/resume',
      })
    }

    // 两个来源都按时间倒序，各取前五足以确定合并后的最近五条。
    for (const job of jobSummaries.slice(0, 5)) {
      const verb = APPLY_STATUS_VERB[job.status] ?? '更新了'

      const target =
        [job.company, job.position].filter(Boolean).join(' · ') || '一个岗位'

      events.push({
        id: `job-${job.id}`,
        type: 'apply',
        title: `${verb} ${target}`,
        timestamp: new Date(job.updated_at).getTime(),
        to: '/tracker',
      })
    }

    events.sort((a, b) => b.timestamp - a.timestamp)

    return {
      events: events.slice(0, 5).map((event) => ({
        ...event,
        time: formatRelativeTime(new Date(event.timestamp)),
      })),
      loading: false,
    }
  }, [
    jobSummaries,
    jobsLoading,
    cloudCount,
    resumesLoading,
    versionSummaries,
    versionsLoading,
  ])
}
