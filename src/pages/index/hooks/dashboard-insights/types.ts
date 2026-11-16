import type { ApplicationStatus } from '@/pages/tracker/types'
import type { listAtsSummaries } from '@/lib/supabase/resume/ats'
import type { listJobApplicationSummaries } from '@/lib/supabase/resume/company'
import type { listResumeHistoryVersionSummaries } from '@/lib/supabase/resume/history/queries'

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
  hint?: string
  tone: DashboardActionTone
  to: string
}

export interface DashboardInsights {
  funnel: DashboardFunnel
  actions: DashboardAction[]
  hasCloudResume: boolean
  loading: boolean
  jobsLoading: boolean
  atsLoading: boolean
}

export type JobSummaries = Awaited<
  ReturnType<typeof listJobApplicationSummaries>
>

export type AtsSummaries = Awaited<ReturnType<typeof listAtsSummaries>>

export type VersionSummaries = Awaited<
  ReturnType<typeof listResumeHistoryVersionSummaries>
>

export interface DashboardResource<T> {
  data: T
  loading: boolean
  error: string | null
  hasLoaded: boolean
  retry: () => void
}

export interface DashboardResources {
  jobs: DashboardResource<JobSummaries>
  ats: DashboardResource<AtsSummaries>
  versions: DashboardResource<VersionSummaries>
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
  // x 轴刻度短文案（相对时间；同一相对时间的多次检测追加 HH:mm 以区分）
  label: string
  // tooltip 完整时间文案
  fullLabel: string
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
  followUpsLoading: boolean
  funnelLoading: boolean
  atsTrendLoading: boolean
  activityLoading: boolean
}
