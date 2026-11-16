import { type EntrySection } from '../../../../supabase/functions/shared/resume-import-contract'
import type { ResumeSchema } from '../../schema/resume'
import { resumeHtmlToText, textToResumeHtml } from '../text'

export const entryFields = {
  edu_background: ['schoolName', 'professional', 'duration', 'eduInfo'],
  work_experience: ['companyName', 'position', 'workDuration', 'workInfo'],
  internship_experience: [
    'companyName',
    'position',
    'internshipDuration',
    'internshipInfo',
  ],
  project_experience: [
    'projectName',
    'participantRole',
    'projectDuration',
    'projectInfo',
  ],
  campus_experience: ['experienceName', 'role', 'duration', 'campusInfo'],
} as const

export const compact = (value: string) =>
  value.normalize('NFKC').replace(/\s+/g, '')

export function preferSourceField(
  local: string,
  incoming: string,
  sourceLine: string,
) {
  if (!incoming) return local

  // Preserve only a strict expansion of the same copied value. A different
  // field on the same line is not evidence that the local semantic role is right.
  return local.length > incoming.length &&
    compact(local).includes(compact(incoming)) &&
    sourceLine.includes(local)
    ? local
    : incoming
}

export function dateValue(value: string) {
  if (/^(至今|现在|present|current)$/i.test(value)) return '至今'

  const match = value.match(
    /^(19\d{2}|20\d{2})(?:[年./-](0?[1-9]|1[0-2])月?)?年?$/,
  )

  return match
    ? `${match[1]}${match[2] ? `-${match[2].padStart(2, '0')}` : ''}`
    : value
}

export function appendMissingText(current: string, incoming: string) {
  const existing = new Set(resumeHtmlToText(current).split('\n').map(compact))

  const additions = resumeHtmlToText(incoming)
    .split('\n')
    .filter((line) => {
      const key = compact(line)

      if (!key || existing.has(key)) return false

      existing.add(key)

      return true
    })

  return current + textToResumeHtml(additions.join('\n'))
}

export function hasResumeContent(content: ResumeSchema): boolean {
  return Boolean(
    content.basics.name ||
    content.basics.email ||
    content.basics.phone ||
    content.job_intent.jobIntent ||
    content.job_intent.intentionalCity ||
    Object.keys(entryFields).some((section) => {
      const key = section as EntrySection
      const fields = entryFields[key]

      return (content[key].items as unknown as Record<string, unknown>[]).some(
        (row) =>
          fields.some((field) => {
            const value = row[field]

            return Array.isArray(value)
              ? value.some(Boolean)
              : typeof value === 'string' &&
                  Boolean(resumeHtmlToText(value).trim())
          }),
      )
    }) ||
    [
      content.skill_specialty.description,
      content.honors_certificates.description,
      content.self_evaluation.content,
      content.hobbies.description,
    ].some((value) => resumeHtmlToText(value).trim()),
  )
}
