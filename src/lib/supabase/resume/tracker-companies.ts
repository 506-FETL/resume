import type {
  CompanyProcessPolicy,
  TrackerCompany,
} from '@/pages/tracker/types'
import supabase from '../client'

export class TrackerProcessError extends Error {
  readonly conflictJobId: string | null

  constructor(message: string, conflictJobId: string | null = null) {
    super(message)
    this.name = 'TrackerProcessError'
    this.conflictJobId = conflictJobId
  }
}

export function trackerProcessError(error: {
  message: string
  details?: string
}) {
  const messages: Record<string, string> = {
    active_process_conflict:
      '这家公司已有进行中的岗位，请先结束该流程，或修改公司的并行规则。',
    submission_required: '请先记录本次投递，原件可以不附。',
    reopen_required: '请使用“恢复流程”，保留此前的结束和面试记录。',
    referral_company_conflict:
      '这个岗位有关联的转岗流程，请先调整这些流程的公司关联。',
    invalid_referral: '转岗来源必须是同一家公司下的其他岗位。',
    company_not_found: '公司不存在或无权访问，请重新选择。',
    job_not_found: '岗位不存在或无权访问。',
    invalid_reopen: '当前流程不能恢复，请重新加载后确认。',
  }

  return new TrackerProcessError(
    messages[error.message] ?? error.message,
    error.message === 'active_process_conflict'
      ? (error.details ?? null)
      : null,
  )
}

export async function listTrackerCompanies(): Promise<TrackerCompany[]> {
  const { data, error } = await supabase
    .from('tracker_companies')
    .select('*')
    .order('name')

  if (error) throw trackerProcessError(error)

  return data
}

export async function updateTrackerCompanyPolicy(
  id: string,
  policy: CompanyProcessPolicy,
): Promise<TrackerCompany> {
  const { data, error } = await supabase.rpc('update_tracker_company_policy', {
    p_company_id: id,
    p_policy: policy,
  })

  if (error) throw trackerProcessError(error)

  return data
}
