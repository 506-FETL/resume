// types.ts
export type ApplicationStatus = 'saved' | 'applied' | 'screen' | 'interview' | 'offer' | 'rejected'
export type StageStatus = '待处理' | '进行中' | '已完成' | '已拒绝'
export type ViewMode = 'list' | 'board'
export type TrackerSortBy = 'updated' | 'created' | 'days' | 'company' | 'status'
export type TrackerSortDir = 'asc' | 'desc'

export interface InterviewSubStage {
  id: string
  label: string
  status: StageStatus
  start_date: string | null
  notes: string
  order: number
}

export interface StageDetail {
  stage: ApplicationStatus
  status: StageStatus
  start_date: string | null
  notes: string
}

export type TrackerActivityType = 'status_change' | 'note' | 'interview' | 'follow_up'

export interface TrackerActivity {
  id: string
  type: TrackerActivityType
  label: string
  at: string // ISO 时间戳
  note?: string
}

export interface TrackerContact {
  id: string
  name: string
  role: string
  channel: string
  note: string
}

export interface JobApplication {
  id: string
  created_at: string
  updated_at: string
  resume_id: string | null
  user_id: string
  company: string
  company_logo: string | null
  position: string
  location: string
  salary: string | null
  job_url: string | null
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
