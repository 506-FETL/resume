import type { JobApplication } from '../../../types'
import type { AddJobFormData } from './types'
import { toast } from 'sonner'

/**
 * Validate the required fields. Shows a toast for the first missing field.
 * Returns true if validation passes.
 */
export function validateAddJobForm(formData: AddJobFormData): boolean {
  if (!formData.position.trim()) {
    toast.error('请填写职位名称')
    return false
  }
  if (!formData.company.trim()) {
    toast.error('请填写公司名称')
    return false
  }
  if (!formData.location.trim()) {
    toast.error('请填写工作地点')
    return false
  }
  return true
}

export function buildJobPayload(formData: AddJobFormData): Omit<JobApplication, 'id' | 'created_at' | 'updated_at' | 'user_id'> {
  return {
    resume_id: formData.resume_id,
    company: formData.company,
    company_logo: formData.company_logo.trim() || null,
    position: formData.position,
    location: formData.location,
    salary: formData.salaryMin && formData.salaryMax
      ? `${formData.salaryMin}K-${formData.salaryMax}K`
      : formData.salaryMin ? `${formData.salaryMin}K` : null,
    job_url: formData.job_url || null,
    status: formData.status,
    stage_details: [{ stage: formData.status, status: '待处理', start_date: null, notes: '' }],
    interview_sub_stages: [],
    archived: false,
    next_action: null,
    next_action_date: null,
    activities: [],
    contacts: [],
  }
}
