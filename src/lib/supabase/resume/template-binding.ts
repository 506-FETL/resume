import { ResumeNotFoundError } from '@/lib/resume-id'
import { readResumeListTemplateBinding } from '@/lib/resume-template/binding'
import { resolveDefaultTemplateBinding } from '@/lib/resume-template/runtime/default-selection'
import supabase from '../client'

/** 只补齐当前账号的无效引用；并发切换模板时保留服务端最新选择。 */
export async function ensureCloudResumeTemplateBinding(
  resumeId: string,
  userId: string,
  value: unknown,
) {
  const existing = readResumeListTemplateBinding(value)

  if (existing) return existing

  const binding = await resolveDefaultTemplateBinding(value)

  const query = supabase
    .from('resume_config')
    .update({ template_binding: binding })
    .eq('resume_id', resumeId)
    .eq('user_id', userId)

  const { data, error } = await (
    value == null
      ? query.or('template_binding.is.null,template_binding.eq.null')
      : query.eq('template_binding', JSON.stringify(value))
  )
    .select('template_binding')
    .maybeSingle()

  if (error) throw error
  if (data) return binding

  const latest = await supabase
    .from('resume_config')
    .select('template_binding')
    .eq('resume_id', resumeId)
    .eq('user_id', userId)
    .maybeSingle()

  if (latest.error) throw latest.error
  if (!latest.data) throw new ResumeNotFoundError()

  const current = readResumeListTemplateBinding(latest.data.template_binding)

  if (!current) throw new Error('简历模板发生变动，请重新加载后重试')

  return current
}
