import supabase from '../../client'
import type { ResumeHistoryShareOption } from '../history/queries/resumes'

export interface ShareResumeOption {
  resume_id: string
  display_name: string
}

export const SHARE_OPTION_PAGE_SIZE = 20

export async function listShareResumeOptions(keyword: string, offset: number) {
  const { data, error } = await supabase.rpc('get_share_resume_options', {
    p_keyword: keyword,
    p_offset: offset,
  })

  if (error) throw error

  if (!Array.isArray(data)) throw new Error('简历列表返回格式异常')

  return data as ShareResumeOption[]
}

export async function listShareVersionOptions(
  resumeId: string,
  keyword: string,
  offset: number,
) {
  const { data, error } = await supabase.rpc('get_share_version_options', {
    p_resume_id: resumeId,
    p_keyword: keyword,
    p_offset: offset,
  })

  if (error) throw error

  if (!Array.isArray(data)) throw new Error('历史版本列表返回格式异常')

  return data as ResumeHistoryShareOption[]
}

export async function getShareVersionOption(
  ownerId: string,
  resumeId: string,
  id: number,
) {
  const { data, error } = await supabase
    .from('resume_config_versions')
    .select('id,version_no,version_name,milestone_name,created_at')
    .eq('user_id', ownerId)
    .eq('resume_id', resumeId)
    .eq('id', id)
    .eq('status', 'frozen')
    .maybeSingle<ResumeHistoryShareOption>()

  if (error) throw error

  return data
}
