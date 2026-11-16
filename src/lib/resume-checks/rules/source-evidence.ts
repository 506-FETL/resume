import { resumeHtmlToText } from '@/lib/resume-import/text'
import type { PreparationRecord } from '@/lib/resume-preparation/types'
import type { ORDERType } from '@/lib/schema'
import { isCheckSectionVisible } from '../targets'
import type { CheckSnapshot, CheckTarget } from '../types'
import type { NewIssue } from './issue-types'

export function evidencePath(id: string, kind: string, section: ORDERType) {
  const prefix = `${kind}:${section}:`

  if (!id.startsWith(prefix)) return null

  try {
    return decodeURIComponent(id.slice(prefix.length))
  } catch {
    return null
  }
}

export function checkSourceEvidence(
  snapshot: CheckSnapshot,
  record: PreparationRecord,
  fields: CheckTarget[],
  aiEvidence: CheckTarget[],
  add: (issue: NewIssue) => void,
) {
  const examples = new Map<string, CheckTarget[]>()

  for (const evidence of record.evidence) {
    if (!isCheckSectionVisible(snapshot, evidence.section)) continue

    const path = evidencePath(evidence.id, evidence.kind, evidence.section)
    const evidenceText = resumeHtmlToText(evidence.text).trim()

    const candidates = fields.filter(
      (field) =>
        field.section === evidence.section &&
        (path ? field.path === path : field.quote === evidenceText),
    )

    // 老记录没有身份时，重复原文无法唯一确认归属。
    if (!path && candidates.length !== 1) continue

    const field = candidates[0]

    if (!field || !evidenceText || field.quote !== evidenceText) continue

    if (evidence.kind === 'ai') {
      if (
        !aiEvidence.some(
          (candidate) =>
            candidate.section === field.section &&
            candidate.path === field.path,
        )
      )
        aiEvidence.push(field)

      continue
    }

    const key = `example:${field.section}:${field.entryId ?? 'section'}`
    const group = examples.get(key) ?? []

    if (!group.some((candidate) => candidate.path === field.path))
      group.push(field)

    examples.set(key, group)
  }

  examples.forEach((targets, id) => {
    add({
      id,
      section: targets[0].section,
      kind: 'example',
      severity: 'warning',
      title: '这处内容仍与示例相同',
      detail: '核对这条经历或模块中的示例是否符合你的情况；确认后可以保留。',
      targets,
    })
  })
}
