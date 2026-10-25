import type { ORDERType, ResumeSchema } from '@/lib/schema'
import type { ImportDraft } from '@/lib/resume-preparation/types'
import { resumeHtmlToText } from '@/lib/resume-import/text'
import { REVIEW_MODULES } from './const'

export function emptyDraft(): ImportDraft {
  return {
    sourceText: '',
    sourceName: '粘贴内容',
    content: null,
    unassignedText: '',
    warnings: [],
    reviewedSections: [],
    unassignedReviewed: false,
    profile: 'graduate',
    updatedAt: new Date().toISOString(),
  }
}

export function populatedSections(content: ResumeSchema): ORDERType[] {
  return REVIEW_MODULES.filter((module) => {
    if (module.section === 'basics') return true

    const section = content[module.section] as unknown as Record<
      string,
      unknown
    >

    const rows = module.arrayKey
      ? (section[module.arrayKey] as Record<string, unknown>[])
      : [section]

    return rows.some((row) =>
      module.fields.some((field) => {
        const value = row[field.key]

        if (Array.isArray(value)) return value.some(Boolean)

        return (
          typeof value === 'string' &&
          value !== '不填' &&
          resumeHtmlToText(value).trim().length > 0
        )
      }),
    )
  }).map((module) => module.section)
}

export function importReady(draft: ImportDraft) {
  return Boolean(
    draft.content &&
    populatedSections(draft.content).every((section) =>
      draft.reviewedSections.includes(section),
    ) &&
    (!draft.unassignedText.trim() || draft.unassignedReviewed),
  )
}
