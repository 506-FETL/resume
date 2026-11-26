import type { AutomergeResumeDocument } from './schema'
import type { PersistedResumeSnapshot } from '@/lib/schema'
import type { Suggestion } from '@/lib/schema/ats'
import get from 'lodash/get'
import toPath from 'lodash/toPath'
import { deepEqual } from '@/lib/ats/result/values'
import { readResumeListTemplateBinding } from '@/lib/resume-template/list-binding'
import { FORM_DATA_KEYS } from '@/store/resume/const'
import { readOwnedResumeRow } from '@/lib/supabase/resume/read-owned-row'
import {
  normalizeResumeFormData,
  normalizeResumeSection,
  resolveResumeTemplateBinding,
} from '@/lib/schema'
import {
  applyResumeEntryIdPatches,
  collectMissingResumeEntryIdPatches,
} from '@/lib/schema/resume/entry-id'
import { updateResumeConfig } from '@/lib/supabase/resume/config'
import { getCurrentUser } from '@/lib/supabase/user'
import { setLeaf } from '@/pages/optimize/utils/values'
import { DocumentManager } from './manager'

export type ResumeDocumentSnapshot = PersistedResumeSnapshot

export async function syncAutomergeDocument(
  resumeId: string,
  updates: Suggestion[],
  options: { syncToResumeConfig?: boolean } = {},
) {
  const suggestions = updates.filter(
    (suggestion) => suggestion.locate.path && !suggestion.fixed,
  )

  if (!suggestions.length) throw new Error('没有可应用的修复建议')

  const sections = [
    ...new Set(suggestions.map((item) => toPath(item.locate.path)[0])),
  ]

  const keys = FORM_DATA_KEYS.filter((key) => sections.includes(key))

  if (keys.length !== sections.length) throw new Error('建议指向的简历栏目无效')

  const user = await getCurrentUser()

  if (!user) throw new Error('用户未登录')

  const manager = new DocumentManager(resumeId, user.id)

  try {
    const readSections = () =>
      readOwnedResumeRow(
        resumeId,
        user.id,
        ['updated_at', 'template_binding', ...keys].join(','),
      )

    const [handle, initialRow] = await Promise.all([
      manager.initialize(),
      options.syncToResumeConfig ? readSections() : null,
    ])

    // 初始化旧文档可能补写模板并改变 updated_at。
    const row =
      initialRow && !readResumeListTemplateBinding(initialRow.template_binding)
        ? await readSections()
        : initialRow

    const doc = handle.doc()

    if (!doc) throw new Error('未取得简历正文')

    const patch = Object.fromEntries(
      keys.map((key) => [key, normalizeResumeSection(key, row?.[key])]),
    )

    const configChanges = row
      ? pendingSuggestionChanges(patch, suggestions)
      : []

    const documentSections = Object.fromEntries(
      keys.map((key) => [key, normalizeResumeSection(key, doc[key])]),
    )

    const documentChanges = pendingSuggestionChanges(
      documentSections,
      suggestions,
    )

    if (documentChanges.length) {
      manager.change((next) => {
        for (const suggestion of documentChanges)
          setLeaf(next, toPath(suggestion.locate.path), suggestion.after)

        const normalized = normalizeResumeFormData(next)

        applyResumeEntryIdPatches(
          next,
          collectMissingResumeEntryIdPatches(next, normalized),
        )
      })

      await manager.saveToSupabase(handle)
    }

    if (row) {
      if (configChanges.length) {
        for (const suggestion of configChanges)
          setLeaf(patch, toPath(suggestion.locate.path), suggestion.after)

        for (const key of keys)
          patch[key] = normalizeResumeSection(key, patch[key])

        await updateResumeConfig(
          resumeId,
          patch,
          row.updated_at as string | null,
        )
      }

      return patch
    }
  } finally {
    manager.destroy()
  }
}

function pendingSuggestionChanges(source: object, suggestions: Suggestion[]) {
  return suggestions.filter(({ locate, before, after }) => {
    const current = get(source, toPath(locate.path)) ?? null

    if (deepEqual(current, after)) return false
    if (!deepEqual(current, before))
      throw new Error('要修改的字段已发生变化，请重新检测后再应用')

    return true
  })
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
    const { templateBinding, ...resumeConfig } = payload

    await updateResumeConfig(resumeId, {
      ...resumeConfig,
      template_binding: templateBinding,
    })

    return payload
  } finally {
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

  doc.application_info =
    payload.application_info as AutomergeResumeDocument['application_info']

  doc.edu_background =
    payload.edu_background as AutomergeResumeDocument['edu_background']

  doc.work_experience =
    payload.work_experience as AutomergeResumeDocument['work_experience']

  doc.internship_experience =
    payload.internship_experience as AutomergeResumeDocument['internship_experience']

  doc.campus_experience =
    payload.campus_experience as AutomergeResumeDocument['campus_experience']

  doc.project_experience =
    payload.project_experience as AutomergeResumeDocument['project_experience']

  doc.skill_specialty =
    payload.skill_specialty as AutomergeResumeDocument['skill_specialty']

  doc.honors_certificates =
    payload.honors_certificates as AutomergeResumeDocument['honors_certificates']

  doc.self_evaluation =
    payload.self_evaluation as AutomergeResumeDocument['self_evaluation']

  doc.hobbies = payload.hobbies as AutomergeResumeDocument['hobbies']
  doc.order = [...payload.order] as AutomergeResumeDocument['order']

  doc.visibility = {
    ...payload.visibility,
  } as AutomergeResumeDocument['visibility']

  doc.type = payload.type as AutomergeResumeDocument['type']

  doc.templateBinding =
    payload.templateBinding as AutomergeResumeDocument['templateBinding']

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
    application_info: cloneResumeValue(
      source.application_info ?? fallback.application_info,
    ),
    edu_background: cloneResumeValue(
      source.edu_background ?? fallback.edu_background,
    ),
    work_experience: cloneResumeValue(
      source.work_experience ?? fallback.work_experience,
    ),
    internship_experience: cloneResumeValue(
      source.internship_experience ?? fallback.internship_experience,
    ),
    campus_experience: cloneResumeValue(
      source.campus_experience ?? fallback.campus_experience,
    ),
    project_experience: cloneResumeValue(
      source.project_experience ?? fallback.project_experience,
    ),
    skill_specialty: cloneResumeValue(
      source.skill_specialty ?? fallback.skill_specialty,
    ),
    honors_certificates: cloneResumeValue(
      source.honors_certificates ?? fallback.honors_certificates,
    ),
    self_evaluation: cloneResumeValue(
      source.self_evaluation ?? fallback.self_evaluation,
    ),
    hobbies: cloneResumeValue(source.hobbies ?? fallback.hobbies),
    order: cloneResumeValue(source.order ?? fallback.order),
    visibility: cloneResumeValue(source.visibility ?? fallback.visibility),
    type: cloneResumeValue(source.type ?? fallback.type),
    templateBinding: cloneResumeValue(
      resolveResumeTemplateBinding(
        source.templateBinding ?? fallback.templateBinding,
      ),
    ),
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
    : (JSON.parse(JSON.stringify(value)) as T)
}
