// types.ts
export type ApplicationStatus = 'saved' | 'applied' | 'screen' | 'interview' | 'offer' | 'rejected'
export type StageStatus = '待处理' | '进行中' | '已完成' | '已拒绝'
export type ViewMode = 'list' | 'board'

export interface StageDetail {
  stage: ApplicationStatus
  status: StageStatus
  start_date: string | null
  notes: string
}

export interface JobApplication {
  id: string
  created_at: string
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
  applied_date: string | null
  notes: string | null
}
