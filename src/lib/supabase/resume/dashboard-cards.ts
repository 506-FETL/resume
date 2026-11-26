import { readResumeListTemplateBinding } from '@/lib/resume-template/list-binding'
import { normalizeResumeType } from '@/lib/schema/resume/resume-type'

export async function getDashboardCloudResumes(ownerId: string) {
  const { default: supabase } = await import('../client')

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
