import type { Resume } from './types'
import type { ApplicationStatus } from '@/pages/tracker/types'
import { useEffect, useMemo, useState } from 'react'
import { listAtsSummaries, listJobApplicationSummaries, listResumeHistoryVersionSummaries } from '@/lib/supabase/resume'
import { isJobPendingFollowUp } from '@/pages/tracker/utils'
import { diffDates, formatRelativeTime } from '@/utils/date'

// 求职漏斗核心指标（首页统计卡数据源）
export interface DashboardFunnel {
  applied: number
  interview: number
  offer: number
  avgAtsScore: number | null
  atsResumeCount: number
}

export type DashboardActionTone = 'urgent' | 'warning' | 'info' | 'muted'

// 聚合后的单条行动项（首页今日待办数据源）
export interface DashboardAction {
  id: string
  count: number
  label: string
  hint: string
  tone: DashboardActionTone
  to: string
}

export interface DashboardInsights {
  funnel: DashboardFunnel
  actions: DashboardAction[]
  hasCloudResume: boolean
  loading: boolean
}

const EMPTY_FUNNEL: DashboardFunnel = {
  applied: 0,
  interview: 0,
  offer: 0,
  avgAtsScore: null,
  atsResumeCount: 0,
}

// 一次拉取 job / ats 概览，产出求职漏斗指标与聚合行动清单，供统计卡与今日待办共用
export function useDashboardInsights(resumes: Resume[], resumesLoading: boolean): DashboardInsights {
  const onlineResumes = useMemo(
    () => resumes.filter(resume => !resume.isOffline),
    [resumes],
  )
  const [funnel, setFunnel] = useState<DashboardFunnel>(EMPTY_FUNNEL)
  const [actions, setActions] = useState<DashboardAction[]>([])
  const [loading, setLoading] = useState(true)

  const resumeIdsKey = useMemo(
    () => onlineResumes.map(resume => resume.resume_id).join(','),
    [onlineResumes],
  )

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (resumesLoading) {
        setLoading(true)
        return
      }

      if (onlineResumes.length === 0) {
        if (!cancelled) {
          setFunnel(EMPTY_FUNNEL)
          setActions([])
          setLoading(false)
        }
        return
      }

      setLoading(true)

      try {
        const [jobSummaries, atsSummaries] = await Promise.all([
          listJobApplicationSummaries(),
          listAtsSummaries(),
        ])

        if (cancelled)
          return

        // 求职漏斗：越过 saved 即视为已投递；面试/Offer 仅统计未归档的在办岗位
        const applied = jobSummaries.filter(job => job.status !== 'saved').length
        const interview = jobSummaries.filter(job => !job.archived && job.status === 'interview').length
        const offer = jobSummaries.filter(job => !job.archived && job.status === 'offer').length
        const pending = jobSummaries.filter(isJobPendingFollowUp).length
        const savedToApply = jobSummaries.filter(job => !job.archived && job.status === 'saved').length

        // 每份简历取最近一次 ATS 检测
        const atsMap = new Map<string, (typeof atsSummaries)[number]>()
        for (const summary of atsSummaries) {
          const existing = atsMap.get(summary.resume_id)
          if (!existing || diffDates(summary.created_at, existing.created_at) > 0)
            atsMap.set(summary.resume_id, summary)
        }

        const onlineIds = new Set(onlineResumes.map(resume => resume.resume_id))
        const latestAtsList = [...atsMap.entries()]
          .filter(([resumeId]) => onlineIds.has(resumeId))
          .map(([, summary]) => summary)

        const scored = latestAtsList
          .map(summary => summary.summary?.overall_score)
          .filter((score): score is number => typeof score === 'number')
        const avgAtsScore = scored.length > 0
          ? Math.round(scored.reduce((sum, score) => sum + score, 0) / scored.length)
          : null

        const atsTodoTotal = latestAtsList.reduce(
          (sum, summary) => sum + (summary.todo_items?.length ?? 0),
          0,
        )
        const resumesWithoutAts = onlineResumes.filter(resume => !atsMap.has(resume.resume_id)).length

        const nextActions: DashboardAction[] = []
        if (pending > 0) {
          nextActions.push({
            id: 'pending',
            count: pending,
            label: '个岗位待跟进',
            hint: '有岗位到期或长时间未推进',
            tone: 'urgent',
            to: '/tracker',
          })
        }
        if (atsTodoTotal > 0) {
          nextActions.push({
            id: 'ats-todo',
            count: atsTodoTotal,
            label: '项简历优化待完成',
            hint: 'ATS 检测给出的改进建议',
            tone: 'warning',
            to: '/optimize',
          })
        }
        if (savedToApply > 0) {
          nextActions.push({
            id: 'to-apply',
            count: savedToApply,
            label: '个收藏岗位待投递',
            hint: '已保存但还没有正式投递',
            tone: 'info',
            to: '/tracker',
          })
        }
        if (resumesWithoutAts > 0) {
          nextActions.push({
            id: 'no-ats',
            count: resumesWithoutAts,
            label: '份简历还没做 ATS 检测',
            hint: '检测通过率，降低被机器筛掉的风险',
            tone: 'muted',
            to: '/optimize',
          })
        }

        if (!cancelled) {
          setFunnel({ applied, interview, offer, avgAtsScore, atsResumeCount: latestAtsList.length })
          setActions(nextActions)
        }
      }
      catch (error) {
        console.error('加载首页求职概览失败:', error)
        if (!cancelled) {
          setFunnel(EMPTY_FUNNEL)
          setActions([])
        }
      }
      finally {
        if (!cancelled)
          setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [onlineResumes, resumesLoading, resumeIdsKey])

  return {
    funnel,
    actions,
    hasCloudResume: onlineResumes.length > 0,
    loading,
  }
}

// 首页「最近动态」时间线事件类型
export type TimelineEventType = 'ai' | 'edit' | 'apply'

export interface TimelineEvent {
  id: string
  type: TimelineEventType
  title: string
  time: string
  timestamp: number
  to: string
}

export interface DashboardTimeline {
  events: TimelineEvent[]
  loading: boolean
}

// job 状态对应的动态文案前缀
const APPLY_STATUS_VERB: Partial<Record<ApplicationStatus, string>> = {
  saved: '收藏了',
  applied: '投递了',
  screen: '进入初筛',
  interview: '面试推进',
  offer: '收到 Offer',
  rejected: '结束了',
}

// 聚合简历版本历史 + 岗位投递，产出按时间倒序的近期事件时间线（首页「最近动态」数据源）
export function useDashboardTimeline(resumes: Resume[], resumesLoading: boolean): DashboardTimeline {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)

  // resume_id -> 展示名，用于时间线文案
  const nameMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const resume of resumes)
      map.set(resume.resume_id, resume.display_name || '未命名简历')
    return map
  }, [resumes])

  const nameMapKey = useMemo(
    () => resumes.map(resume => `${resume.resume_id}:${resume.display_name ?? ''}`).join('|'),
    [resumes],
  )

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (resumesLoading) {
        setLoading(true)
        return
      }

      setLoading(true)

      try {
        const [versionSummaries, jobSummaries] = await Promise.all([
          listResumeHistoryVersionSummaries(),
          listJobApplicationSummaries(),
        ])

        if (cancelled)
          return

        const next: TimelineEvent[] = []

        for (const version of versionSummaries) {
          const resumeName = nameMap.get(version.resume_id)
          // 只展示当前存在的简历，避免出现已删除简历的孤儿事件
          if (!resumeName)
            continue
          const isAi = version.source_type === 'ai_optimize'
          next.push({
            id: `version-${version.resume_id}-${version.version_no}`,
            type: isAi ? 'ai' : 'edit',
            title: isAi ? `AI 助手更新了《${resumeName}》` : `编辑了《${resumeName}》`,
            time: formatRelativeTime(version.created_at),
            timestamp: new Date(version.created_at).getTime(),
            to: '/resume',
          })
        }

        for (const job of jobSummaries) {
          const verb = APPLY_STATUS_VERB[job.status] ?? '更新了'
          const target = [job.company, job.position].filter(Boolean).join(' · ') || '一个岗位'
          next.push({
            id: `job-${job.id}`,
            type: 'apply',
            title: `${verb} ${target}`,
            time: formatRelativeTime(job.updated_at),
            timestamp: new Date(job.updated_at).getTime(),
            to: '/tracker',
          })
        }

        next.sort((a, b) => b.timestamp - a.timestamp)

        if (!cancelled)
          setEvents(next.slice(0, 5))
      }
      catch (error) {
        console.error('加载首页最近动态失败:', error)
        if (!cancelled)
          setEvents([])
      }
      finally {
        if (!cancelled)
          setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [nameMap, nameMapKey, resumesLoading])

  return { events, loading }
}
