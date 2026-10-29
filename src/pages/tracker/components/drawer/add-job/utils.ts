import type { JobApplication } from '../../../types'
import type { AddJobFormData } from './types'
import { toast } from 'sonner'
import { normalizeJobWorkflow } from '../../../workflow'

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

  return true
}

export function buildJobPayload(
  formData: AddJobFormData,
): Omit<
  JobApplication,
  | 'id'
  | 'created_at'
  | 'updated_at'
  | 'user_id'
  | 'tracker_company_id'
  | 'focused_at'
> & { tracker_company_id: string | null } {
  return normalizeJobWorkflow({
    resume_id: formData.resume_id,
    company: formData.company,
    tracker_company_id: formData.tracker_company_id,
    recruitment_batch: formData.recruitment_batch.trim() || null,
    referred_from_job_id: formData.referred_from_job_id,
    company_logo: formData.company_logo.trim() || null,
    position: formData.position,
    location: formData.location,
    salary:
      formData.salaryMin && formData.salaryMax
        ? `${formData.salaryMin}K-${formData.salaryMax}K`
        : formData.salaryMin
          ? `${formData.salaryMin}K`
          : null,
    job_url: formData.job_url || null,
    jd_text: formData.jd_text.trim() || null,
    source: formData.source.trim() || null,
    status: formData.status,
    stage_details: [
      {
        stage: formData.status,
        status: '待处理',
        start_date: null,
        notes: '',
        ...(formData.status === 'offer' || formData.status === 'rejected'
          ? { source_stage: null }
          : {}),
      },
    ],
    interview_sub_stages: [],
    archived: false,
    next_action: null,
    next_action_date: null,
    activities: [],
    contacts: [],
  })
}
