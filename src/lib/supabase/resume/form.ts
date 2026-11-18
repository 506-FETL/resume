import type { ResumeTemplateBinding, ResumeType } from '@/lib/schema'
import { notifyResumeReadChanged } from '@/lib/resume-read-events'
import { isCloudResumeId, ResumeNotFoundError } from '@/lib/resume-id'
import { toTemplateBinding } from '@/lib/resume-template/binding'
import { getDefaultTemplateSelection } from '@/lib/resume-template/runtime/default-selection'
import { resolveTemplate } from '@/lib/resume-template/runtime/resolve-template'
import { resumeTemplateSource } from '@/lib/resume-template/source'
import { DEFAULT_RESUME_APPEARANCE } from '@/lib/schema'
import supabase from '../client'
import { getCurrentUser } from '../user'
import { RESUME_PERSISTED_FIELDS } from './persisted-fields'
import { ensureCloudResumeTemplateBinding } from './template-binding'

export {
  createResumeFromSnapshot,
  findPreparedCloudResume,
} from './create-template'

export { RESUME_PERSISTED_SELECTOR } from './persisted-fields'

export { getResumeOptions, getResumeSummaries } from './summaries'

export async function getAllResumesFromUser() {
  const user = await getCurrentUser()

  if (!user) throw new Error('用户未登陆')

  const { data, error } = await supabase
    .from('resume_config')
    .select(
      'id,resume_id,created_at,updated_at,type,display_name,description,parent_resume_id,linked_jd_text,derived_metadata,derived_status,template_binding',
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return Promise.all(
    data.map(async (resume) => {
      const templateBinding = await ensureCloudResumeTemplateBinding(
        resume.resume_id,
        user.id,
        resume.template_binding,
      )

      return { ...resume, template_binding: templateBinding, templateBinding }
    }),
  )
}

export { getResumeById } from './get-by-id'

export async function uploadOfflineResumeToCloud(
  resumeData: Record<string, unknown>,
  info: { display_name: string; description?: string },
  type: ResumeType = 'default',
  options?: { resumeId: string; expectedOwner: string },
) {
  const user = await getCurrentUser()

  if (!user) throw new Error('用户未登陆')
  if (options && user.id !== options.expectedOwner)
    throw new Error('登录状态已改变，请使用发起同步时的账号重试')

  const findExisting = async () => {
    const { data, error } = await supabase
      .from('resume_config')
      .select()
      .eq('user_id', user.id)
      .eq('resume_id', options!.resumeId)
      .maybeSingle()

    if (error) throw error

    return data
  }

  // 安全字段白名单，避免覆盖 user_id 等安全字段
  const ALLOWED_FIELDS = [...RESUME_PERSISTED_FIELDS]
  const safeData: Record<string, unknown> = {}

  for (const key of ALLOWED_FIELDS) {
    if (key in resumeData) {
      safeData[key] = resumeData[key]
    }
  }

  if (!('template_binding' in safeData) && 'templateBinding' in resumeData) {
    safeData.template_binding = resumeData.templateBinding
  }

  const payload = {
    ...(options ? { resume_id: options.resumeId } : {}),
    user_id: user.id,
    type,
    ...DEFAULT_RESUME_APPEARANCE,
    ...info,
    ...safeData,
  }

  const canonical = (value: unknown): string => {
    if (value == null) return 'null'
    if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
    if (typeof value === 'object')
      return `{${Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
        .join(',')}}`

    return JSON.stringify(value)
  }

  const verifyExisting = (existing: Record<string, unknown>) => {
    if (
      [...new Set([...Object.keys(payload), ...RESUME_PERSISTED_FIELDS])].some(
        (key) =>
          canonical(existing[key]) !==
          canonical((payload as Record<string, unknown>)[key]),
      )
    )
      throw new Error(
        '本地与已同步的云端内容不同，已保留本地简历。请核对两份内容后再处理。',
      )

    return existing
  }

  if (options) {
    const existing = await findExisting()

    if (existing) return verifyExisting(existing)
    if ((await getCurrentUser())?.id !== user.id)
      throw new Error('登录状态已改变')
  }

  const { data, error } = await supabase
    .from('resume_config')
    .insert(payload)
    .select()
    .single()

  if (error) {
    if (options) {
      const existing = await findExisting()

      if (existing) return verifyExisting(existing)
    }

    throw error
  }

  notifyResumeReadChanged(data.resume_id)

  return data
}

export async function createNewResume(
  info: { display_name?: string; description?: string } = {
    display_name: '简历',
    description: new Date().toLocaleDateString(),
  },
  type: ResumeType = 'default',
  options?: { templateBinding?: ResumeTemplateBinding },
) {
  const user = await getCurrentUser()

  if (!user) throw new Error('用户未登陆')

  const binding =
    options?.templateBinding ??
    toTemplateBinding((await getDefaultTemplateSelection()).template)

  const definition = await resolveTemplate(resumeTemplateSource, binding)

  const { data, error } = await supabase
    .from('resume_config')
    .insert({
      user_id: user.id,
      type,
      template_binding: binding,
      ...definition.appearanceDefaults,
      ...info,
    })
    .select()
    .single()

  if (error) {
    throw error
  }

  notifyResumeReadChanged(data.resume_id)

  return data
}

/**
 * 删除简历
 * @param id 标识值
 * @param by 按哪个列删除，默认 'resume_id'
 */
export async function deleteResume(
  id: string,
  by: 'resume_id' | 'id' = 'resume_id',
) {
  if (by === 'resume_id' && !isCloudResumeId(id))
    throw new ResumeNotFoundError()

  const user = await getCurrentUser()

  if (!user) throw new Error('用户未登陆')

  const { error } = await supabase
    .from('resume_config')
    .delete()
    .eq(by, id)
    .eq('user_id', user.id)

  if (error) {
    throw error
  }

  notifyResumeReadChanged(by === 'resume_id' ? id : undefined)

  return true
}

/** @deprecated 使用 deleteResume(id, 'id') 替代 */
export const deleteResumeFromId = (id: string) => deleteResume(id, 'id')
