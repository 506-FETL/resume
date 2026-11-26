import { isCloudResumeId, ResumeNotFoundError } from '@/lib/resume-id'
import { readOwnedResumeRow } from './read-owned-row'
import { getCurrentUser } from '../user/profile'
import { ensureCloudResumeTemplateBinding } from './template-binding'

export async function getResumeById<T = Record<string, unknown>>(
  id: string,
  selector = '*',
) {
  if (!isCloudResumeId(id)) throw new ResumeNotFoundError()

  const user = await getCurrentUser()

  if (!user) throw new Error('用户未登陆')

  const data = await readOwnedResumeRow(id, user.id, selector)

  if ('template_binding' in data)
    data.template_binding = await ensureCloudResumeTemplateBinding(
      id,
      user.id,
      data.template_binding,
    )

  return data as T
}
