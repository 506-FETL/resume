import type { Resume } from './types'
import type { ApplicationStatus } from '@/pages/tracker/types'
import { useEffect, useMemo, useState } from 'react'
import { countPendingAtsFindings } from '@/lib/ats'
import { listAtsSummaries, listJobApplicationSummaries, listResumeHistoryVersionSummaries } from '@/lib/supabase/resume'
import { APPLICATION_STATUS_CONFIG, APPLICATION_STATUS_ORDER } from '@/pages/tracker/const'
import { getDaysUntil, isJobPendingFollowUp } from '@/pages/tracker/utils'
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
          (sum, summary) => sum + countPendingAtsFindings(summary.findings),
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

// ==================== 首页扩展模块（待跟进 / 漏斗 / ATS 趋势 / 本周活跃度） ====================

// 待跟进岗位（首页 Top3 数据源）
export interface FollowUpJob {
  id: string
  company: string
  position: string
  status: ApplicationStatus
  statusLabel: string
  // 距下一步天数：负=逾期，0=今天，正=未来，null=按陈旧度判定（无 next_action_date）
  daysUntil: number | null
}

// 求职漏斗单阶段（按当前状态分布，非历史漏斗口径）
export interface FunnelStage {
  status: ApplicationStatus
  label: string
  count: number
}

// ATS 分数趋势单点
export interface AtsTrendPoint {
  index: number
  score: number
  label: string
}

// 近 7 天单日活跃度
export interface ActivityDay {
  label: string
  date: string
  edits: number
  applies: number
  total: number
}

export interface DashboardExtras {
  followUps: FollowUpJob[]
  followUpTotal: number
  funnel: FunnelStage[]
  atsTrend: AtsTrendPoint[]
  activity: ActivityDay[]
  loading: boolean
}

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

/**
 * 一次拉取 job / ats / version 概览，聚合出首页四个扩展模块的数据：
 * - 待跟进 Top3：isJobPendingFollowUp 口径，按 next_action 紧迫度排序
 * - 求职漏斗：saved→…→offer 按当前状态分布（非历史漏斗，避免 summary 缺 stage_details）
 * - ATS 趋势：每份简历最近一次检测分，按时间正序（最多取近 8 次）
 * - 本周活跃度：近 7 天编辑（version）与投递（job.updated_at）事件按日计数
 * 复用与 useDashboardInsights 相同的 summary 接口，均基于现有数据源、无需新表。
 */
export function useDashboardExtras(resumes: Resume[], resumesLoading: boolean): DashboardExtras {
  const onlineResumes = useMemo(
    () => resumes.filter(resume => !resume.isOffline),
    [resumes],
  )
  const [extras, setExtras] = useState<Omit<DashboardExtras, 'loading'>>({
    followUps: [],
    followUpTotal: 0,
    funnel: [],
    atsTrend: [],
    activity: [],
  })
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
          setExtras({ followUps: [], followUpTotal: 0, funnel: [], atsTrend: [], activity: [] })
          setLoading(false)
        }
        return
      }

      setLoading(true)

      try {
        const [jobSummaries, atsSummaries, versionSummaries] = await Promise.all([
          listJobApplicationSummaries(),
          listAtsSummaries(),
          listResumeHistoryVersionSummaries(),
        ])

        if (cancelled)
          return

        // —— 待跟进 Top3：逾期优先，其次今天/临期，最后陈旧项 ——
        const pendingJobs = jobSummaries.filter(isJobPendingFollowUp)
        const rankFollowUp = (job: typeof jobSummaries[number]) => {
          const days = getDaysUntil(job.next_action_date)
          // 有明确日期的按天数升序（逾期最靠前）；无日期的排在有日期之后
          return days ?? Number.MAX_SAFE_INTEGER
        }
        const followUps: FollowUpJob[] = [...pendingJobs]
          .sort((a, b) => rankFollowUp(a) - rankFollowUp(b))
          .slice(0, 3)
          .map(job => ({
            id: job.id,
            company: job.company || '未命名公司',
            position: job.position || '未填写职位',
            status: job.status,
            statusLabel: APPLICATION_STATUS_CONFIG[job.status]?.label ?? job.status,
            daysUntil: getDaysUntil(job.next_action_date),
          }))

        // —— 求职漏斗：按当前状态分布（未归档）——
        const activeJobs = jobSummaries.filter(job => !job.archived)
        const funnel: FunnelStage[] = APPLICATION_STATUS_ORDER.map(status => ({
          status,
          label: APPLICATION_STATUS_CONFIG[status]?.label ?? status,
          count: activeJobs.filter(job => job.status === status).length,
        }))

        // —— ATS 趋势：每份简历最近一次分，按时间正序，最多近 8 份 ——
        const onlineIds = new Set(onlineResumes.map(resume => resume.resume_id))
        const latestAtsByResume = new Map<string, (typeof atsSummaries)[number]>()
        for (const summary of atsSummaries) {
          if (!onlineIds.has(summary.resume_id))
            continue
          const existing = latestAtsByResume.get(summary.resume_id)
          if (!existing || diffDates(summary.created_at, existing.created_at) > 0)
            latestAtsByResume.set(summary.resume_id, summary)
        }
        const atsTrend: AtsTrendPoint[] = [...latestAtsByResume.values()]
          .filter(summary => typeof summary.summary?.overall_score === 'number')
          .sort((a, b) => diffDates(a.created_at, b.created_at))
          .slice(-8)
          .map((summary, index) => ({
            index,
            score: summary.summary!.overall_score as number,
            label: formatRelativeTime(summary.created_at),
          }))

        // —— 本周活跃度：本周一→周日，编辑（version）+ 投递（job.updated_at）按日计数 ——
        // 用本地日期键（避免 toISOString 的 UTC 偏移在东八区把事件算到前一天）
        const toLocalKey = (d: Date) => {
          const y = d.getFullYear()
          const m = String(d.getMonth() + 1).padStart(2, '0')
          const day = String(d.getDate()).padStart(2, '0')
          return `${y}-${m}-${day}`
        }
        const days: ActivityDay[] = []
        const dayKeyToIdx = new Map<string, number>()
        // 定位本周一：getDay() 0=周日..6=周六，(getDay()+6)%7 即回退到本周一的天数
        const monday = new Date()
        monday.setHours(0, 0, 0, 0)
        monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
        for (let i = 0; i < 7; i += 1) {
          const d = new Date(monday)
          d.setDate(monday.getDate() + i)
          const key = toLocalKey(d)
          dayKeyToIdx.set(key, days.length)
          days.push({ label: WEEKDAY_LABELS[d.getDay()], date: key, edits: 0, applies: 0, total: 0 })
        }
        const bump = (iso: string, field: 'edits' | 'applies') => {
          const key = toLocalKey(new Date(iso))
          const idx = dayKeyToIdx.get(key)
          if (idx === undefined)
            return
          days[idx][field] += 1
          days[idx].total += 1
        }
        for (const version of versionSummaries) {
          if (onlineIds.has(version.resume_id))
            bump(version.created_at, 'edits')
        }
        for (const job of jobSummaries) {
          if (job.status !== 'saved')
            bump(job.updated_at, 'applies')
        }

        if (!cancelled)
          setExtras({ followUps, followUpTotal: pendingJobs.length, funnel, atsTrend, activity: days })
      }
      catch (error) {
        console.error('加载首页扩展模块失败:', error)
        if (!cancelled)
          setExtras({ followUps: [], followUpTotal: 0, funnel: [], atsTrend: [], activity: [] })
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

  return { ...extras, loading }
}
