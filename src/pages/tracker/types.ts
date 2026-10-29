// types.ts
export type ApplicationStatus =
  | 'saved'
  | 'applied'
  | 'assessment'
  | 'screen'
  | 'written'
  | 'interview'
  | 'offer'
  | 'rejected'

export type StageStatus = '待处理' | '进行中' | '已完成' | '已拒绝'

export type ViewMode = 'list' | 'board'

export type TrackerSortBy =
  | 'updated'
  | 'created'
  | 'days'
  | 'company'
  | 'status'

export type TrackerSortDir = 'asc' | 'desc'

export interface InterviewSubStage {
  id: string
  label: string
  status: StageStatus
  start_date: string | null
  notes: string
  order: number
  is_history?: boolean
}

export interface StageDetail {
  stage: ApplicationStatus
  status: StageStatus
  start_date: string | null
  notes: string
  // 终态的真实来源；null 明确表示来源未知，不用历史深度替代。
  source_stage?: Exclude<ApplicationStatus, 'offer' | 'rejected'> | null
}

export type TrackerActivityType =
  | 'status_change'
  | 'note'
  | 'interview'
  | 'follow_up'
  | 'workflow_resume'

export interface TrackerActivity {
  id: string
  type: TrackerActivityType
  label: string
  at: string // ISO 时间戳
  note?: string
  resume_details?: {
    date: string
    target: ApplicationStatus
    ended_detail: StageDetail | null
    source_stage: ApplicationStatus | null
    history_round_ids: string[]
  }
}

export interface TrackerContact {
  id: string
  name: string
  role: string
  channel: string
  note: string
}

export interface JobApplication {
  focused_at: string | null
  id: string
  created_at: string
  updated_at: string
  resume_id: string | null
  user_id: string
  company: string
  company_logo: string | null
  tracker_company_id: string
  recruitment_batch: string | null
  referred_from_job_id: string | null
  has_submission?: boolean
  unresolved_submissions?: boolean
  position: string
  location: string
  salary: string | null
  job_url: string | null
  jd_text?: string | null
  jd_updated_at?: string | null
  source?: string | null
  status: ApplicationStatus
  stage_details: StageDetail[]
  interview_sub_stages: InterviewSubStage[]
  archived: boolean
  next_action: string | null
  next_action_date: string | null
  activities: TrackerActivity[]
  contacts: TrackerContact[]
}

export type DrawerTab = 'follow-up' | 'interview' | 'documents'

// 概览聚合指标筛选键（与 filterStatus 互斥）
export type TrackerMetricKey = 'applied' | 'interview' | 'offer' | 'pending'

export type CompanyProcessPolicy =
  | 'unknown'
  | 'single_active'
  | 'multiple_active'

export interface TrackerCompany {
  id: string
  user_id: string
  name: string
  logo: string | null
  process_policy: CompanyProcessPolicy
}

export interface ReopenProcessInput {
  jobId: string
  eventId: string
  target: 'assessment' | 'screen' | 'written' | 'interview'
  date: string
  reason: string
}
