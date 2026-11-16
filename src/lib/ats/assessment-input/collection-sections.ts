import type { ResumeSchema } from '../../schema/resume/form/index.ts'
import { ATS_SECTION_LABELS } from '../constants.ts'
import type { AtsAssessmentItem, AtsAssessmentSection } from '../types.ts'
import { createField, isMeaningfulAtsValue } from './fields.ts'

export interface RepeatedSectionConfig {
  key:
    | 'edu_background'
    | 'work_experience'
    | 'internship_experience'
    | 'campus_experience'
    | 'project_experience'
  collectionKey: 'items'
  itemPrefix: string
  fields: Array<{ key: string; requiredWithinEntry: boolean }>
}

export const REPEATED_SECTIONS: RepeatedSectionConfig[] = [
  {
    key: 'edu_background',
    collectionKey: 'items',
    itemPrefix: '教育',
    fields: [
      { key: 'schoolName', requiredWithinEntry: true },
      { key: 'professional', requiredWithinEntry: true },
      { key: 'degree', requiredWithinEntry: true },
      { key: 'duration', requiredWithinEntry: true },
      { key: 'eduInfo', requiredWithinEntry: false },
    ],
  },
  {
    key: 'work_experience',
    collectionKey: 'items',
    itemPrefix: '工作',
    fields: [
      { key: 'companyName', requiredWithinEntry: true },
      { key: 'position', requiredWithinEntry: true },
      { key: 'workDuration', requiredWithinEntry: true },
      { key: 'workInfo', requiredWithinEntry: true },
    ],
  },
  {
    key: 'internship_experience',
    collectionKey: 'items',
    itemPrefix: '实习',
    fields: [
      { key: 'companyName', requiredWithinEntry: true },
      { key: 'position', requiredWithinEntry: true },
      { key: 'internshipDuration', requiredWithinEntry: true },
      { key: 'internshipInfo', requiredWithinEntry: true },
    ],
  },
  {
    key: 'campus_experience',
    collectionKey: 'items',
    itemPrefix: '校园',
    fields: [
      { key: 'experienceName', requiredWithinEntry: true },
      { key: 'role', requiredWithinEntry: true },
      { key: 'duration', requiredWithinEntry: true },
      { key: 'campusInfo', requiredWithinEntry: true },
    ],
  },
  {
    key: 'project_experience',
    collectionKey: 'items',
    itemPrefix: '项目',
    fields: [
      { key: 'projectName', requiredWithinEntry: true },
      { key: 'participantRole', requiredWithinEntry: true },
      { key: 'projectDuration', requiredWithinEntry: true },
      { key: 'projectInfo', requiredWithinEntry: true },
    ],
  },
]

export function createRepeatedSection(
  resume: ResumeSchema,
  config: RepeatedSectionConfig,
): AtsAssessmentSection | null {
  const section = resume[config.key] as {
    items: Array<Record<string, unknown> & { entryId: string }>
  }

  const items = section.items.flatMap<AtsAssessmentItem>(
    (item, sourceIndex) => {
      const active = config.fields.some((field) =>
        isMeaningfulAtsValue(item[field.key]),
      )

      if (!active) return []

      const itemLabel = `${config.itemPrefix} ${sourceIndex + 1}`

      return [
        {
          entryId: item.entryId,
          itemLabel,
          sourceIndex,
          fields: config.fields.map((field) =>
            createField({
              sectionKey: config.key,
              fieldKey: field.key,
              path: `${config.key}.${config.collectionKey}[${sourceIndex}].${field.key}`,
              rawValue: item[field.key],
              requiredWithinEntry: field.requiredWithinEntry,
              itemLabel,
            }),
          ),
        },
      ]
    },
  )

  if (items.length === 0) return null

  return {
    key: config.key,
    label: ATS_SECTION_LABELS[config.key],
    items,
  }
}

export function createSkillSection(
  resume: ResumeSchema,
): AtsAssessmentSection | null {
  const items: AtsAssessmentItem[] = []

  if (isMeaningfulAtsValue(resume.skill_specialty.description)) {
    items.push({
      entryId: null,
      itemLabel: null,
      sourceIndex: null,
      fields: [
        createField({
          sectionKey: 'skill_specialty',
          fieldKey: 'description',
          path: 'skill_specialty.description',
          rawValue: resume.skill_specialty.description,
          itemLabel: null,
        }),
      ],
    })
  }

  resume.skill_specialty.skills.forEach((skill, sourceIndex) => {
    if (!isMeaningfulAtsValue(skill.label)) return

    const itemLabel = `技能 ${sourceIndex + 1}`

    items.push({
      entryId: skill.entryId,
      itemLabel,
      sourceIndex,
      fields: [
        createField({
          sectionKey: 'skill_specialty',
          fieldKey: 'label',
          path: `skill_specialty.skills[${sourceIndex}].label`,
          rawValue: skill.label,
          requiredWithinEntry: true,
          itemLabel,
        }),
        createField({
          sectionKey: 'skill_specialty',
          fieldKey: 'proficiencyLevel',
          path: `skill_specialty.skills[${sourceIndex}].proficiencyLevel`,
          rawValue: skill.proficiencyLevel,
          itemLabel,
        }),
      ],
    })
  })

  if (items.length === 0) return null

  return {
    key: 'skill_specialty',
    label: ATS_SECTION_LABELS.skill_specialty,
    items,
  }
}

export function createNamedListSection(config: {
  collection: Array<{ entryId: string; name: string }>
  collectionKey: 'certificates' | 'hobbies'
  description: string
  itemPrefix: string
  key: 'honors_certificates' | 'hobbies'
}): AtsAssessmentSection | null {
  const items: AtsAssessmentItem[] = []

  if (isMeaningfulAtsValue(config.description)) {
    items.push({
      entryId: null,
      itemLabel: null,
      sourceIndex: null,
      fields: [
        createField({
          sectionKey: config.key,
          fieldKey: 'description',
          path: `${config.key}.description`,
          rawValue: config.description,
          itemLabel: null,
        }),
      ],
    })
  }

  config.collection.forEach((item, sourceIndex) => {
    if (!isMeaningfulAtsValue(item.name)) return

    const itemLabel = `${config.itemPrefix} ${sourceIndex + 1}`

    items.push({
      entryId: item.entryId,
      itemLabel,
      sourceIndex,
      fields: [
        createField({
          sectionKey: config.key,
          fieldKey: config.collectionKey,
          path: `${config.key}.${config.collectionKey}[${sourceIndex}].name`,
          rawValue: item.name,
          itemLabel,
        }),
      ],
    })
  })

  if (items.length === 0) return null

  return { key: config.key, label: ATS_SECTION_LABELS[config.key], items }
}
