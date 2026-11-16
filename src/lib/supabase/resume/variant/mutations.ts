import { applyVariantChange } from '@/components/jd-variant/utils/apply-changes'
import { notifyResumeReadChanged } from '@/lib/resume-read-events'
import type {
  PersistedResumeSnapshot,
  VariantChange,
  VariantMetadata,
} from '@/lib/schema'
import supabase from '../../client'
import { getCurrentUser } from '../../user'

export async function cloneResumeAsDraft(args: {
  parent: PersistedResumeSnapshot & { resume_id: string; display_name?: string }
  jdText: string
  keywords: string[]
  summary?: string
  draftId?: string
  expectedOwner?: string
}): Promise<string> {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error('用户未登陆')
  }

  if (args.expectedOwner && user.id !== args.expectedOwner)
    throw new Error('登录状态已改变')

  const findExisting = async () => {
    const { data, error } = await supabase
      .from('resume_config')
      .select('resume_id,parent_resume_id')
      .eq('user_id', user.id)
      .eq('resume_id', args.draftId!)
      .maybeSingle()

    if (error) throw error
    if (data && data.parent_resume_id !== args.parent.resume_id)
      throw new Error('派生目标不一致')

    return data
  }

  let existingDraft = false

  if (args.draftId) {
    existingDraft = !!(await findExisting())

    if ((await getCurrentUser())?.id !== user.id)
      throw new Error('登录状态已改变')
  }

  const initialMetadata: VariantMetadata = {
    keywords: args.keywords,
    changes: [],
    generatedAt: new Date().toISOString(),
    matchRate: 0,
  }

  const cloneTitle = args.summary?.slice(0, 16) || args.keywords[0] || 'JD 变体'
  const display_name = `${args.parent.display_name ?? '简历'} - ${cloneTitle}`

  const payload = {
    ...(args.draftId ? { resume_id: args.draftId } : {}),
    user_id: user.id,
    type: args.parent.type,
    basics: args.parent.basics ?? null,
    job_intent: args.parent.job_intent ?? null,
    application_info: args.parent.application_info ?? null,
    edu_background: args.parent.edu_background ?? null,
    work_experience: args.parent.work_experience ?? null,
    internship_experience: args.parent.internship_experience ?? null,
    campus_experience: args.parent.campus_experience ?? null,
    project_experience: args.parent.project_experience ?? null,
    skill_specialty: args.parent.skill_specialty ?? null,
    honors_certificates: args.parent.honors_certificates ?? null,
    self_evaluation: args.parent.self_evaluation ?? null,
    hobbies: args.parent.hobbies ?? null,
    order: args.parent.order ?? null,
    visibility: args.parent.visibility ?? null,
    spacing: args.parent.spacing,
    font: args.parent.font,
    theme: args.parent.theme,
    template_binding: args.parent.templateBinding ?? null,
    display_name,
    description: `JD 变体 · ${new Date().toLocaleDateString()}`,
    parent_resume_id: args.parent.resume_id,
    linked_jd_text: args.jdText,
    derived_metadata: initialMetadata,
    derived_status: 'generating',
  }

  const query = supabase.from('resume_config')

  const { data, error } = await (
    existingDraft
      ? query
          .update(payload)
          .eq('resume_id', args.draftId!)
          .eq('user_id', user.id)
      : query.insert(payload)
  )
    .select('resume_id')
    .single()

  if (error) {
    if (args.draftId && !existingDraft) {
      const existing = await findExisting()

      if (existing) {
        notifyResumeReadChanged(existing.resume_id)

        return existing.resume_id
      }
    }

    throw error
  }

  const resumeId = (data as { resume_id: string }).resume_id

  notifyResumeReadChanged(resumeId)

  return resumeId
}

export async function applyVariantChanges(
  draftResumeId: string,
  snapshot: PersistedResumeSnapshot,
  changes: VariantChange[],
  expectedOwner?: string,
): Promise<PersistedResumeSnapshot> {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error('用户未登陆')
  }

  if (expectedOwner && user.id !== expectedOwner)
    throw new Error('登录状态已改变')

  let next = snapshot

  for (const change of changes) {
    next = applyVariantChange(next, change)
  }

  if (next === snapshot) {
    return snapshot
  }

  const updates: Record<string, unknown> = {}

  for (const sec of new Set(changes.map((c) => c.section))) {
    updates[sec as string] = (next as unknown as Record<string, unknown>)[
      sec as string
    ]
  }

  const { error } = await supabase
    .from('resume_config')
    .update(updates)
    .eq('resume_id', draftResumeId)
    .eq('user_id', user.id)

  if (error) {
    throw error
  }

  notifyResumeReadChanged(draftResumeId)

  return next
}

export async function markVariantReady(
  draftResumeId: string,
  args: {
    matchRate: number
    generatedAt: string
    changes: VariantChange[]
    keywords: string[]
    expectedOwner?: string
  },
): Promise<void> {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error('用户未登陆')
  }

  if (args.expectedOwner && user.id !== args.expectedOwner)
    throw new Error('登录状态已改变')

  const next: VariantMetadata = {
    keywords: args.keywords,
    changes: args.changes,
    matchRate: args.matchRate,
    generatedAt: args.generatedAt,
  }

  if ((await getCurrentUser())?.id !== user.id)
    throw new Error('登录状态已改变')

  const { error } = await supabase
    .from('resume_config')
    .update({
      derived_status: 'ready',
      derived_metadata: next,
    })
    .eq('resume_id', draftResumeId)
    .eq('user_id', user.id)
    .select('resume_id')
    .single()

  if (error) {
    throw error
  }

  notifyResumeReadChanged(draftResumeId)
}

export async function markVariantFailed(
  draftResumeId: string,
  errorMessage: string,
): Promise<void> {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error('用户未登陆')
  }

  const { error } = await supabase
    .from('resume_config')
    .update({
      derived_status: 'failed',
      description: `派生失败：${errorMessage.slice(0, 200)}`,
    })
    .eq('resume_id', draftResumeId)
    .eq('user_id', user.id)

  if (error) {
    throw error
  }

  notifyResumeReadChanged(draftResumeId)
}

export async function deleteDraftVariant(draftResumeId: string): Promise<void> {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error('用户未登陆')
  }

  const { error } = await supabase
    .from('resume_config')
    .delete()
    .eq('resume_id', draftResumeId)
    .eq('user_id', user.id)

  if (error) {
    throw error
  }

  notifyResumeReadChanged(draftResumeId)
}
