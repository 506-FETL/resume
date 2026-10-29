import type { ApplicationStatus } from '../../../types'

export interface AddJobFormData {
  position: string
  company: string
  tracker_company_id: string | null
  recruitment_batch: string
  referred_from_job_id: string | null
  location: string
  status: ApplicationStatus
  job_url: string
  company_logo: string
  jd_text: string
  source: string
  salaryMin: string
  salaryMax: string
  resume_id: string | null
}

export const INITIAL_FORM_DATA: AddJobFormData = {
  position: '',
  company: '',
  tracker_company_id: null,
  recruitment_batch: '',
  referred_from_job_id: null,
  location: '',
  status: 'saved',
  job_url: '',
  company_logo: '',
  jd_text: '',
  source: '',
  salaryMin: '',
  salaryMax: '',
  resume_id: null,
}
