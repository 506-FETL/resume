import type { PreparationRecord } from './types'
import type { ORDERType, ResumeSchema, VisibilityFormType } from '@/lib/schema'
import { evidencePath, plainText, sectionFields } from './evidence'

export interface PreparationIssue {
  id: string
  section: ORDERType
  kind: 'missing' | 'example' | 'ai'
  title: string
  detail: string
  signature: string
  resolved: boolean
  reason?: string
}

export type CheckSnapshot = ResumeSchema & {
  order?: ORDERType[]
  visibility?: Partial<VisibilityFormType>
}

/** 保存完整内容签名，避免哈希碰撞使另一份内容错误沿用核实结果。 */
export const contentSignature = (value: unknown) => JSON.stringify(value)

export function checkResumePreparation(
  snapshot: CheckSnapshot,
  record: PreparationRecord,
): PreparationIssue[] {
  const issues: PreparationIssue[] = []

  const visible = (section: ORDERType) =>
    section === 'basics' ||
    (snapshot.visibility?.[section] !== true &&
      (!snapshot.order || snapshot.order.includes(section)))

  const add = (issue: Omit<PreparationIssue, 'resolved' | 'reason'>) => {
    const resolution = record.resolutions[issue.id]

    const resolved =
      !!resolution?.reason.trim() && resolution.signature === issue.signature

    issues.push({
      ...issue,
      resolved,
      reason: resolved ? resolution.reason : undefined,
    })
  }

  if (!snapshot.basics.name.trim()) {
    add({
      id: 'missing:name',
      section: 'basics',
      kind: 'missing',
      title: '还没有填写姓名',
      detail: '填写用于求职的姓名。',
      signature: contentSignature(snapshot.basics.name),
    })
  }
  if (!snapshot.basics.phone.trim() && !snapshot.basics.email.trim()) {
    add({
      id: 'missing:contact',
      section: 'basics',
      kind: 'missing',
      title: '还没有填写联系方式',
      detail: '电话和邮箱至少填写一项。',
      signature: contentSignature([
        snapshot.basics.phone,
        snapshot.basics.email,
      ]),
    })
  }

  const experienceSections: ORDERType[] = [
    'work_experience',
    'internship_experience',
    'project_experience',
    'campus_experience',
  ]

  const experiences = experienceSections
    .filter(visible)
    .map((section) => ({ section, fields: sectionFields(snapshot[section]) }))

  const hasExperience = experiences.some(({ fields }) =>
    fields.some(
      (field) =>
        /\/(workInfo|internshipInfo|projectInfo|campusInfo)$/.test(
          field.path,
        ) && plainText(field.text).length > 0,
    ),
  )

  if (!hasExperience) {
    add({
      id: 'missing:experience',
      section: 'project_experience',
      kind: 'missing',
      title: '还没有可导出的经历说明',
      detail:
        '补充一段工作、实习、项目或校园经历，说明你做了什么。隐藏的经历不会导出。',
      signature: contentSignature(experiences),
    })
  }

  const entryNames = [
    ['edu_background', 'schoolName', '学校名称'],
    ['work_experience', 'companyName', '公司名称'],
    ['internship_experience', 'companyName', '公司名称'],
    ['project_experience', 'projectName', '项目名称'],
    ['campus_experience', 'experienceName', '活动名称'],
  ] as const

  for (const [section, nameKey, label] of entryNames) {
    if (!visible(section)) continue

    const rows = snapshot[section].items

    rows.forEach((item, index) => {
      const row = item as unknown as Record<string, unknown>
      const title = String(row[nameKey] ?? '').trim()

      const hasContent = Object.entries(row).some(([key, value]) => {
        if (['entryId', 'hidden', nameKey].includes(key)) return false
        if (Array.isArray(value)) return value.some(Boolean)

        return (
          typeof value === 'string' &&
          value !== '不填' &&
          Boolean(plainText(value))
        )
      })

      if (item.hidden || title || !hasContent) return

      add({
        id: `missing:title:${section}:${item.entryId ?? index}`,
        section,
        kind: 'missing',
        title: `有一条经历还没填写${label}`,
        detail: `第 ${index + 1} 条已有内容，但缺少${label}。请补填；如果需要匿名，可说明原因。`,
        signature: contentSignature(item),
      })
    })
  }

  for (const evidence of record.evidence) {
    if (!visible(evidence.section)) continue

    const fields = sectionFields(snapshot[evidence.section])
    const path = evidencePath(evidence)

    const field = path
      ? fields.find((item) => item.path === path)
      : fields.find((item) => item.text === plainText(evidence.text))

    if (
      !field ||
      (evidence.kind === 'example' && field.text !== plainText(evidence.text))
    )
      continue

    add({
      id: evidence.id,
      section: evidence.section,
      kind: evidence.kind,
      title:
        evidence.kind === 'example'
          ? '这段示例还没有修改'
          : '这段 AI 修改还没有核实',
      detail: field.text,
      signature: contentSignature([evidence.section, field.path, field.text]),
    })
  }

  return issues
}
