import { isCloudResumeId, ResumeNotFoundError } from '@/lib/resume-id'
import supabase from '../client'
import { getCurrentUser } from '../user'
import { ensureCloudResumeTemplateBinding } from './template-binding'

export async function getResumeById<T = Record<string, unknown>>(
  id: string,
  selector = '*',
) {
  if (!isCloudResumeId(id)) throw new ResumeNotFoundError()

  const user = await getCurrentUser()

  if (!user) throw new Error('用户未登陆')

  const { data, error } = await supabase
    .from('resume_config')
    .select(selector)
    .eq('user_id', user.id)
    .eq('resume_id', id)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) throw new ResumeNotFoundError()

  if ('template_binding' in data)
    data.template_binding = await ensureCloudResumeTemplateBinding(
      id,
      user.id,
      data.template_binding,
    )

  return data as T
}
