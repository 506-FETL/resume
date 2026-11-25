import { readResumeListTemplateBinding } from '@/lib/resume-template/list-binding'
import { normalizeResumeType } from '@/lib/schema/resume/resume-type'
import supabase from '../client'
import { collectPages } from '../pagination'
import { getCurrentUser } from '../user'

export async function getResumeOptions() {
  const user = await getCurrentUser()

  if (!user) throw new Error('用户未登陆')

  return collectPages(async (from, to) => {
    const { data, error } = await supabase
      .from('resume_config')
      .select('id,resume_id,display_name,type')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to)

    if (error) throw error

    return data
  }, 500)
}

export async function getResumeSummaries(limit?: number) {
  const user = await getCurrentUser()

  if (!user) throw new Error('用户未登陆')

  const fetchPage = async (from: number, to: number) => {
    const { data, error } = await supabase
      .from('resume_config')
      .select(
        'id,resume_id,created_at,updated_at,type,display_name,description,parent_resume_id,derived_status,template_binding',
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to)

    if (error) throw error

    return data ?? []
  }

  const data = await (limit === undefined
    ? collectPages(fetchPage)
    : fetchPage(0, limit - 1))

  return data.map((resume) => ({
    ...resume,
    templateBinding: readResumeListTemplateBinding(resume.template_binding),
  }))
}

export async function getDashboardCloudResumes(ownerId: string) {
  const { data, count, error } = await supabase
    .from('dashboard_resume_cards')
    .select(
      'resume_id,created_at,updated_at,type,display_name,parent_resume_id,template_binding',
      { count: 'exact' },
    )
    .eq('user_id', ownerId)
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(2)

  if (error) throw error
  if (count === null) throw new Error('未能读取云端简历数量')

  const items = data.map(({ template_binding, ...card }) => ({
    ...card,
    type: normalizeResumeType(card.type),
    templateBinding: readResumeListTemplateBinding(template_binding),
    isOffline: false,
  }))

  return { total: count, items }
}
