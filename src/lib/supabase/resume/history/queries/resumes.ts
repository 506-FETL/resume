import supabase from '../../../client'
import { collectPages } from '../../../pagination'
import { getCurrentUser } from '../../../user'
import { getResumeById } from '../../form'
import type {
  ResumeHistoryOptionRecord,
  ResumeHistoryResumeRecord,
  ResumeHistoryVersionListRow,
} from '../types'
import { RESUME_OPTION_SELECTOR, RESUME_SELECTOR } from './selectors'

export async function getResumeHistoryResume(resumeId: string) {
  return getResumeById<ResumeHistoryResumeRecord>(resumeId, RESUME_SELECTOR)
}

export async function listResumeHistoryOptions() {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error('用户未登陆')
  }

  const { data, error } = await supabase
    .from('resume_config')
    .select(RESUME_OPTION_SELECTOR)
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as ResumeHistoryOptionRecord[]
}

export type ResumeHistoryShareOption = Pick<
  ResumeHistoryVersionListRow,
  'id' | 'version_no' | 'version_name' | 'milestone_name' | 'created_at'
>

export async function listResumeHistoryShareOptions(resumeId: string) {
  const user = await getCurrentUser()

  if (!user) throw new Error('用户未登陆')

  return collectPages(async (from, to) => {
    const { data, error } = await supabase
      .from('resume_config_versions')
      .select('id,version_no,version_name,milestone_name,created_at')
      .eq('resume_id', resumeId)
      .eq('user_id', user.id)
      .eq('status', 'frozen')
      .order('version_no', { ascending: false })
      .range(from, to)

    if (error) throw error

    return data
  })
}
