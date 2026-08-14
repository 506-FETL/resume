import type { AutomergeResumeDocument } from './schema'
import type { PersistedResumeSnapshot } from '@/lib/schema'
import type { Suggestion } from '@/lib/schema/ats'
import { set, toPath } from 'lodash'
import { toast } from 'sonner'
import { normalizeResumeFormData } from '@/lib/schema'
import { applyResumeEntryIdPatches, collectMissingResumeEntryIdPatches } from '@/lib/schema/resume/entry-id'
import { getResumeById, updateResumeConfig } from '@/lib/supabase/resume'
import { getCurrentUser } from '@/lib/supabase/user'
import { setLeaf } from '@/pages/optimize/utils'
import { DocumentManager } from './manager'

export type ResumeDocumentSnapshot = PersistedResumeSnapshot

export async function syncAutomergeDocument(
  resumeId: string,
  updates: Suggestion[],
  options: { syncToResumeConfig?: boolean } = {},
) {
  const validSuggestions = updates?.filter(s => s?.locate?.path) || []

  if (validSuggestions.length === 0) {
    return
  }

  const user = await getCurrentUser()

  if (!user) {
    return
  }

  const manager = new DocumentManager(resumeId, user.id)
  const handle = await manager.initialize()

  manager.change((doc) => {
    validSuggestions.forEach((suggestion) => {
      setLeaf(doc, toPath(suggestion.locate.path), suggestion.after)
    })

    const normalized = normalizeResumeFormData(doc)
    applyResumeEntryIdPatches(
      doc,
      collectMissingResumeEntryIdPatches(doc, normalized),
    )
  })

  await manager.saveToSupabase(handle)

  if (!options.syncToResumeConfig) {
    return
  }

  try {
    const resumeConfig = await getResumeById(resumeId)

    validSuggestions.forEach((suggestion) => {
      set(resumeConfig, suggestion.locate.path, suggestion.after)
    })

    const normalized = normalizeResumeFormData(resumeConfig)
    applyResumeEntryIdPatches(
      resumeConfig,
      collectMissingResumeEntryIdPatches(resumeConfig, normalized),
    )

    await updateResumeConfig(resumeId, resumeConfig)
  }
  catch (error) {
    toast.error(`Failed to sync to resume_config：${error}`)
  }
}

export async function replaceAutomergeDocumentSnapshot(
  resumeId: string,
  snapshot: ResumeDocumentSnapshot,
) {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error('用户未登录')
  }

  const manager = new DocumentManager(resumeId, user.id)

  try {
    const handle = await manager.initialize()

    manager.change((doc) => {
      applySnapshotToDocument(doc, snapshot)
    })

    await manager.saveToSupabase(handle)

    const resolvedDoc = handle.doc()
    const payload = pickResumePayload(resolvedDoc ?? snapshot, snapshot)
    await updateResumeConfig(resumeId, payload)

    return payload
  }
  finally {
    manager.destroy()
  }
}

function applySnapshotToDocument(
  doc: AutomergeResumeDocument,
  snapshot: ResumeDocumentSnapshot,
) {
  const payload = pickResumePayload(snapshot, snapshot)

  doc.basics = payload.basics as AutomergeResumeDocument['basics']
  doc.job_intent = payload.job_intent as AutomergeResumeDocument['job_intent']
  doc.application_info = payload.application_info as AutomergeResumeDocument['application_info']
  doc.edu_background = payload.edu_background as AutomergeResumeDocument['edu_background']
  doc.work_experience = payload.work_experience as AutomergeResumeDocument['work_experience']
  doc.internship_experience = payload.internship_experience as AutomergeResumeDocument['internship_experience']
  doc.campus_experience = payload.campus_experience as AutomergeResumeDocument['campus_experience']
  doc.project_experience = payload.project_experience as AutomergeResumeDocument['project_experience']
  doc.skill_specialty = payload.skill_specialty as AutomergeResumeDocument['skill_specialty']
  doc.honors_certificates = payload.honors_certificates as AutomergeResumeDocument['honors_certificates']
  doc.self_evaluation = payload.self_evaluation as AutomergeResumeDocument['self_evaluation']
  doc.hobbies = payload.hobbies as AutomergeResumeDocument['hobbies']
  doc.order = [...payload.order] as AutomergeResumeDocument['order']
  doc.visibility = { ...payload.visibility } as AutomergeResumeDocument['visibility']
  doc.type = payload.type as AutomergeResumeDocument['type']
  doc.spacing = { ...payload.spacing } as AutomergeResumeDocument['spacing']
  doc.font = { ...payload.font } as AutomergeResumeDocument['font']
  doc.theme = { ...payload.theme } as AutomergeResumeDocument['theme']
}

function pickResumePayload(
  source: Partial<ResumeDocumentSnapshot | AutomergeResumeDocument>,
  fallback: ResumeDocumentSnapshot,
): ResumeDocumentSnapshot {
  const payload = {
    basics: cloneResumeValue(source.basics ?? fallback.basics),
    job_intent: cloneResumeValue(source.job_intent ?? fallback.job_intent),
    application_info: cloneResumeValue(source.application_info ?? fallback.application_info),
    edu_background: cloneResumeValue(source.edu_background ?? fallback.edu_background),
    work_experience: cloneResumeValue(source.work_experience ?? fallback.work_experience),
    internship_experience: cloneResumeValue(source.internship_experience ?? fallback.internship_experience),
    campus_experience: cloneResumeValue(source.campus_experience ?? fallback.campus_experience),
    project_experience: cloneResumeValue(source.project_experience ?? fallback.project_experience),
    skill_specialty: cloneResumeValue(source.skill_specialty ?? fallback.skill_specialty),
    honors_certificates: cloneResumeValue(source.honors_certificates ?? fallback.honors_certificates),
    self_evaluation: cloneResumeValue(source.self_evaluation ?? fallback.self_evaluation),
    hobbies: cloneResumeValue(source.hobbies ?? fallback.hobbies),
    order: cloneResumeValue(source.order ?? fallback.order),
    visibility: cloneResumeValue(source.visibility ?? fallback.visibility),
    type: cloneResumeValue(source.type ?? fallback.type),
    spacing: cloneResumeValue(source.spacing ?? fallback.spacing),
    font: cloneResumeValue(source.font ?? fallback.font),
    theme: cloneResumeValue(source.theme ?? fallback.theme),
  }

  return {
    ...payload,
    ...normalizeResumeFormData(payload),
  }
}

function cloneResumeValue<T>(value: T): T {
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value)) as T
}
