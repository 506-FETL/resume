import type { ResumeTemplateBinding, ResumeType } from '@/lib/schema'
import type { TemplateSourceKind } from '@/lib/supabase/template'
import { isCloudResumeId, ResumeNotFoundError } from '@/lib/resume-id'
import { getResumeTypeFromTemplateSource } from '@/lib/resume-template/runtime'
import { createLegacyResumeTemplateBinding, DEFAULT_RESUME_APPEARANCE } from '@/lib/schema'
import supabase from '../client'
import { getCurrentUser } from '../user'

const RESUME_PERSISTED_FIELDS = [
  'basics',
  'job_intent',
  'application_info',
  'edu_background',
  'work_experience',
  'internship_experience',
  'campus_experience',
  'project_experience',
  'skill_specialty',
  'honors_certificates',
  'self_evaluation',
  'hobbies',
  'order',
  'visibility',
  'type',
  'template_binding',
  'spacing',
  'font',
  'theme',
  'parent_resume_id',
  'linked_jd_text',
  'derived_metadata',
  'derived_status',
] as const

export const RESUME_PERSISTED_SELECTOR = RESUME_PERSISTED_FIELDS.join(',')

export async function getAllResumesFromUser() {
  const user = await getCurrentUser()

  if (!user)
    throw new Error('用户未登陆')

  const { data, error } = await supabase
    .from('resume_config')
    .select('id,resume_id,created_at,updated_at,type,display_name,description,parent_resume_id,linked_jd_text,derived_metadata,derived_status')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return data
}

export async function getResumeById<T = Record<string, unknown>>(id: string, selector = '*') {
  if (!isCloudResumeId(id))
    throw new ResumeNotFoundError()

  const user = await getCurrentUser()

  if (!user)
    throw new Error('用户未登陆')

  const { data, error } = await supabase
    .from('resume_config')
    .select(selector)
    .eq('user_id', user.id)
    .eq('resume_id', id)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data)
    throw new ResumeNotFoundError()

  return data as T
}

export async function uploadOfflineResumeToCloud(
  resumeData: Record<string, unknown>,
  info: { display_name: string, description?: string },
  type: ResumeType = 'default',
) {
  const user = await getCurrentUser()

  if (!user)
    throw new Error('用户未登陆')

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

  const { data, error } = await supabase
    .from('resume_config')
    .insert({
      user_id: user.id,
      type,
      ...DEFAULT_RESUME_APPEARANCE,
      ...info,
      ...safeData,
    })
    .select()
    .single()

  if (error) {
    throw error
  }

  return data
}

export async function createNewResume(
  info: { display_name?: string, description?: string } = {
    display_name: '简历',
    description: new Date().toLocaleDateString(),
  },
  type: ResumeType = 'default',
  options?: { templateBinding?: ResumeTemplateBinding },
) {
  const user = await getCurrentUser()

  if (!user)
    throw new Error('用户未登陆')

  const { data, error } = await supabase
    .from('resume_config')
    .insert({
      user_id: user.id,
      type,
      template_binding: options?.templateBinding ?? createLegacyResumeTemplateBinding(type),
      ...DEFAULT_RESUME_APPEARANCE,
      ...info,
    })
    .select()
    .single()

  if (error) {
    throw error
  }

  return data
}

export async function createResumeFromTemplate(input: {
  source: TemplateSourceKind
  templateId: string
  display_name?: string
  description?: string
}) {
  const fallbackType = await getResumeTypeFromTemplateSource(input.source, input.templateId)
  const templateBinding: ResumeTemplateBinding = {
    source: input.source,
    templateId: input.templateId,
    basedOnResumeType: fallbackType,
  }

  return createNewResume(
    {
      display_name: input.display_name,
      description: input.description,
    },
    fallbackType,
    { templateBinding },
  )
}

/**
 * 删除简历
 * @param id 标识值
 * @param by 按哪个列删除，默认 'resume_id'
 */
export async function deleteResume(id: string, by: 'resume_id' | 'id' = 'resume_id') {
  if (by === 'resume_id' && !isCloudResumeId(id))
    throw new ResumeNotFoundError()

  const user = await getCurrentUser()

  if (!user)
    throw new Error('用户未登陆')

  const { error } = await supabase.from('resume_config').delete().eq(by, id).eq('user_id', user.id)

  if (error) {
    throw error
  }

  return true
}

/** @deprecated 使用 deleteResume(id, 'id') 替代 */
export const deleteResumeFromId = (id: string) => deleteResume(id, 'id')
