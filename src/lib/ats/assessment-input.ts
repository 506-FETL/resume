import type { RawValue } from '../schema/ats.ts'
import type { ResumeSchema } from '../schema/resume/form/index.ts'
import type { AtsAssessmentField, AtsAssessmentInput, AtsAssessmentItem, AtsAssessmentSection } from './types.ts'
import { ATS_FIELD_LABELS, ATS_SECTION_LABELS } from './constants.ts'

type AtsSectionKey = keyof typeof ATS_SECTION_LABELS

interface RepeatedSectionConfig {
  key: 'edu_background' | 'work_experience' | 'internship_experience' | 'campus_experience' | 'project_experience'
  collectionKey: 'items'
  itemPrefix: string
  fields: Array<{ key: string, requiredWithinEntry: boolean }>
}

const REPEATED_SECTIONS: RepeatedSectionConfig[] = [
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

function normalizePlainText(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isMeaningfulAtsValue(value: unknown): boolean {
  if (value === null || value === undefined)
    return false

  if (typeof value === 'string') {
    const normalized = normalizePlainText(value)
    return normalized !== '' && normalized !== '不填'
  }

  if (typeof value === 'number')
    return Number.isFinite(value) && value !== 0

  if (typeof value === 'boolean')
    return value

  if (Array.isArray(value))
    return value.some(item => isMeaningfulAtsValue(item))

  if (typeof value === 'object')
    return Object.entries(value).some(([key, item]) => key !== 'entryId' && isMeaningfulAtsValue(item))

  return false
}

function toRawValue(value: unknown): RawValue {
  if (
    typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
    || value === null
    || Array.isArray(value)
    || (typeof value === 'object' && value !== null)
  ) {
    return value as RawValue
  }

  return null
}

function createField(config: {
  fieldKey: string
  itemLabel: string | null
  path: string
  rawValue: unknown
  requiredWithinEntry?: boolean
  sectionKey: AtsSectionKey
}): AtsAssessmentField {
  return {
    locate: {
      path: config.path,
      sectionLabel: ATS_SECTION_LABELS[config.sectionKey],
      fieldLabel: ATS_FIELD_LABELS[config.fieldKey] ?? config.fieldKey,
      itemLabel: config.itemLabel,
    },
    rawValue: toRawValue(config.rawValue),
    requiredWithinEntry: config.requiredWithinEntry ?? false,
  }
}

function createSingleItemSection(
  key: AtsSectionKey,
  fields: AtsAssessmentField[],
): AtsAssessmentSection | null {
  if (fields.length === 0)
    return null

  return {
    key,
    label: ATS_SECTION_LABELS[key],
    items: [{
      entryId: null,
      itemLabel: null,
      sourceIndex: null,
      fields,
    }],
  }
}

function createBasicsSection(resume: ResumeSchema): AtsAssessmentSection {
  const fields: AtsAssessmentField[] = [
    createField({ sectionKey: 'basics', fieldKey: 'name', path: 'basics.name', rawValue: resume.basics.name, requiredWithinEntry: true, itemLabel: null }),
    createField({ sectionKey: 'basics', fieldKey: 'phone', path: 'basics.phone', rawValue: resume.basics.phone, requiredWithinEntry: true, itemLabel: null }),
    createField({ sectionKey: 'basics', fieldKey: 'email', path: 'basics.email', rawValue: resume.basics.email, requiredWithinEntry: true, itemLabel: null }),
  ]

  if (isMeaningfulAtsValue(resume.basics.workYears)) {
    fields.push(createField({ sectionKey: 'basics', fieldKey: 'workYears', path: 'basics.workYears', rawValue: resume.basics.workYears, itemLabel: null }))
  }

  resume.basics.customFields.forEach((field, index) => {
    if (!field || !isMeaningfulAtsValue(field.value))
      return

    fields.push({
      locate: {
        path: `basics.customFields[${index}].value`,
        sectionLabel: ATS_SECTION_LABELS.basics,
        fieldLabel: field.label || `自定义信息 ${index + 1}`,
        itemLabel: null,
      },
      rawValue: field.value,
      requiredWithinEntry: false,
    })
  })

  return createSingleItemSection('basics', fields)!
}

function createJobIntentSection(resume: ResumeSchema): AtsAssessmentSection | null {
  const fieldKeys = ['jobIntent', 'intentionalCity', 'expectedSalary', 'dateEntry'] as const
  const fields = fieldKeys.flatMap((fieldKey) => {
    const rawValue = resume.job_intent[fieldKey]
    if (!isMeaningfulAtsValue(rawValue))
      return []

    return [createField({
      sectionKey: 'job_intent',
      fieldKey,
      path: `job_intent.${fieldKey}`,
      rawValue,
      itemLabel: null,
    })]
  })

  return createSingleItemSection('job_intent', fields)
}

function createRepeatedSection(
  resume: ResumeSchema,
  config: RepeatedSectionConfig,
): AtsAssessmentSection | null {
  const section = resume[config.key] as { items: Array<Record<string, unknown> & { entryId: string }> }
  const items = section.items.flatMap<AtsAssessmentItem>((item, sourceIndex) => {
    const active = config.fields.some(field => isMeaningfulAtsValue(item[field.key]))
    if (!active)
      return []

    const itemLabel = `${config.itemPrefix} ${sourceIndex + 1}`
    return [{
      entryId: item.entryId,
      itemLabel,
      sourceIndex,
      fields: config.fields.map(field => createField({
        sectionKey: config.key,
        fieldKey: field.key,
        path: `${config.key}.${config.collectionKey}[${sourceIndex}].${field.key}`,
        rawValue: item[field.key],
        requiredWithinEntry: field.requiredWithinEntry,
        itemLabel,
      })),
    }]
  })

  if (items.length === 0)
    return null

  return {
    key: config.key,
    label: ATS_SECTION_LABELS[config.key],
    items,
  }
}

function createSkillSection(resume: ResumeSchema): AtsAssessmentSection | null {
  const items: AtsAssessmentItem[] = []

  if (isMeaningfulAtsValue(resume.skill_specialty.description)) {
    items.push({
      entryId: null,
      itemLabel: null,
      sourceIndex: null,
      fields: [createField({
        sectionKey: 'skill_specialty',
        fieldKey: 'description',
        path: 'skill_specialty.description',
        rawValue: resume.skill_specialty.description,
        itemLabel: null,
      })],
    })
  }

  resume.skill_specialty.skills.forEach((skill, sourceIndex) => {
    if (!isMeaningfulAtsValue(skill.label))
      return

    const itemLabel = `技能 ${sourceIndex + 1}`
    items.push({
      entryId: skill.entryId,
      itemLabel,
      sourceIndex,
      fields: [
        createField({ sectionKey: 'skill_specialty', fieldKey: 'label', path: `skill_specialty.skills[${sourceIndex}].label`, rawValue: skill.label, requiredWithinEntry: true, itemLabel }),
        createField({ sectionKey: 'skill_specialty', fieldKey: 'proficiencyLevel', path: `skill_specialty.skills[${sourceIndex}].proficiencyLevel`, rawValue: skill.proficiencyLevel, itemLabel }),
      ],
    })
  })

  if (items.length === 0)
    return null

  return { key: 'skill_specialty', label: ATS_SECTION_LABELS.skill_specialty, items }
}

function createNamedListSection(config: {
  collection: Array<{ entryId: string, name: string }>
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
      fields: [createField({
        sectionKey: config.key,
        fieldKey: 'description',
        path: `${config.key}.description`,
        rawValue: config.description,
        itemLabel: null,
      })],
    })
  }

  config.collection.forEach((item, sourceIndex) => {
    if (!isMeaningfulAtsValue(item.name))
      return

    const itemLabel = `${config.itemPrefix} ${sourceIndex + 1}`
    items.push({
      entryId: item.entryId,
      itemLabel,
      sourceIndex,
      fields: [createField({
        sectionKey: config.key,
        fieldKey: config.collectionKey,
        path: `${config.key}.${config.collectionKey}[${sourceIndex}].name`,
        rawValue: item.name,
        itemLabel,
      })],
    })
  })

  if (items.length === 0)
    return null

  return { key: config.key, label: ATS_SECTION_LABELS[config.key], items }
}

function createSelfEvaluationSection(resume: ResumeSchema): AtsAssessmentSection | null {
  if (!isMeaningfulAtsValue(resume.self_evaluation.content))
    return null

  return createSingleItemSection('self_evaluation', [createField({
    sectionKey: 'self_evaluation',
    fieldKey: 'content',
    path: 'self_evaluation.content',
    rawValue: resume.self_evaluation.content,
    itemLabel: null,
  })])
}

export function buildAtsAssessmentInput(resume: ResumeSchema): AtsAssessmentInput {
  const candidateSections: Array<AtsAssessmentSection | null> = [
    createBasicsSection(resume),
    createJobIntentSection(resume),
    ...REPEATED_SECTIONS.map(config => createRepeatedSection(resume, config)),
    createSkillSection(resume),
    createNamedListSection({
      key: 'honors_certificates',
      collectionKey: 'certificates',
      collection: resume.honors_certificates.certificates,
      description: resume.honors_certificates.description,
      itemPrefix: '证书',
    }),
    createSelfEvaluationSection(resume),
    createNamedListSection({
      key: 'hobbies',
      collectionKey: 'hobbies',
      collection: resume.hobbies.hobbies,
      description: resume.hobbies.description,
      itemPrefix: '兴趣',
    }),
  ]
  const sections = candidateSections.filter((section): section is AtsAssessmentSection => section !== null)
  const evaluatedSectionKeys = new Set(sections.map(section => section.key))
  const optionalSectionKeys = Object.keys(ATS_SECTION_LABELS)
    .filter(key => key !== 'basics') as AtsSectionKey[]

  return {
    rubricVersion: '2.0',
    sections,
    scope: {
      evaluatedSections: sections.map(section => section.label),
      ignoredEmptySections: optionalSectionKeys
        .filter(key => !evaluatedSectionKeys.has(key))
        .map(key => ATS_SECTION_LABELS[key]),
      hasContactMethod: isMeaningfulAtsValue(resume.basics.phone) || isMeaningfulAtsValue(resume.basics.email),
    },
  }
}

export function flattenAssessmentFields(input: AtsAssessmentInput): AtsAssessmentField[] {
  return input.sections.flatMap(section => section.items.flatMap(item => item.fields))
}
