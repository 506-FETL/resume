import type { TemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import type { CommentAnchorDocumentResult } from '@/features/resume-comments/anchors/types'
import { ATS_FIELD_LABELS, ATS_SECTION_LABELS } from '@/lib/ats/constants'

const FIELD_LABELS: Record<string, string> = {
  ...ATS_FIELD_LABELS,
  photo: '照片',
  gender: '性别',
  birthMonth: '出生年月',
  nation: '民族',
  nativePlace: '籍贯',
  heightCm: '身高',
  weightKg: '体重',
  maritalStatus: '婚姻情况',
  politicalStatus: '政治面貌',
  applicationSchool: '申请院校',
  applicationMajor: '申请专业',
  professionalDegree: '专业与学历',
  age: '年龄',
  height: '身高',
  weight: '体重',
  skill: '技能与熟练程度',
  label: '技能',
  proficiencyLevel: '熟练程度',
  content: '经历描述',
  description: '描述',
}

const PROJECTED_FIELDS: Record<string, string> = {
  birthMonth: 'age',
  heightCm: 'height',
  weightKg: 'weight',
  professional: 'professionalDegree',
  degree: 'professionalDegree',
  label: 'skill',
  proficiencyLevel: 'skill',
}

export function buildAnnotationFields(
  model: CommentAnchorDocumentResult,
  data: TemplateResumeData,
) {
  const entryNames = new Map<string, string>()

  for (const section of Object.values(data)) {
    if (!section || typeof section !== 'object') continue

    for (const collection of Object.values(section)) {
      if (!Array.isArray(collection)) continue

      for (const entry of collection) {
        if (!entry || typeof entry !== 'object' || !('entryId' in entry))
          continue

        entryNames.set(
          String(entry.entryId),
          entry.schoolName ||
            entry.companyName ||
            entry.projectName ||
            entry.experienceName ||
            entry.label ||
            entry.name ||
            '',
        )
      }
    }
  }

  const fieldLabel = (sectionKey: string, entryId: string, key: string) =>
    [
      ATS_SECTION_LABELS[sectionKey as keyof typeof ATS_SECTION_LABELS] ??
        '申请信息',
      entryNames.get(entryId),
      key.startsWith('customFields.')
        ? `自定义字段 ${Number(key.split('.')[1]) + 1}`
        : (FIELD_LABELS[key] ?? '字段'),
    ]
      .filter(Boolean)
      .join(' · ')

  const result = new Map(
    model.document.nodes.map((node) => [
      node.nodeKey,
      {
        nodeKey: node.nodeKey,
        label: fieldLabel(node.sectionKey, node.entryId, node.fieldKey),
        text: node.text,
      },
    ]),
  )

  for (const [sectionKey, section] of Object.entries(data)) {
    if (
      !section ||
      typeof section !== 'object' ||
      Array.isArray(section) ||
      !(
        'basics' === sectionKey ||
        sectionKey in ATS_SECTION_LABELS ||
        sectionKey === 'application_info'
      )
    )
      continue

    const appendFields = (entry: Record<string, unknown>, entryId: string) => {
      for (const [key, value] of Object.entries(entry)) {
        if (
          !(key in FIELD_LABELS) ||
          (Array.isArray(value) && key === 'customFields')
        )
          continue

        const projectedKey =
          PROJECTED_FIELDS[key] ??
          (/Info$/.test(key)
            ? 'content'
            : /Duration$/.test(key)
              ? 'duration'
              : key)

        const nodeKey = `${sectionKey}/${entryId}/${projectedKey}`
        const label = fieldLabel(sectionKey, entryId, projectedKey)

        const hasContent = Array.isArray(value)
          ? value.some(
              (part) =>
                typeof part === 'string' && part.trim() && part !== '不填',
            )
          : typeof value === 'string'
            ? Boolean(value.trim()) && value !== '不填'
            : typeof value === 'number'

        if (!result.has(nodeKey))
          result.set(nodeKey, {
            nodeKey,
            label,
            text: hasContent
              ? key === 'photo'
                ? '已添加照片'
                : '已有内容，当前未展示'
              : '',
          })
      }
    }

    appendFields(section as Record<string, unknown>, 'singleton')

    for (const value of Object.values(section)) {
      if (!Array.isArray(value)) continue

      for (const entry of value)
        if (
          entry &&
          typeof entry === 'object' &&
          'entryId' in entry &&
          !entry.hidden
        )
          appendFields(entry, String(entry.entryId))
    }
  }

  return [...result.values()]
}
