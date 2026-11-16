import type { ResumeSchema } from '../../schema/resume/form/index.ts'
import { ATS_SECTION_LABELS } from '../constants.ts'
import type { AtsAssessmentField, AtsAssessmentSection } from '../types.ts'
import {
  createField,
  createSingleItemSection,
  isMeaningfulAtsValue,
} from './fields.ts'

export function createBasicsSection(
  resume: ResumeSchema,
): AtsAssessmentSection {
  const fields: AtsAssessmentField[] = [
    createField({
      sectionKey: 'basics',
      fieldKey: 'name',
      path: 'basics.name',
      rawValue: resume.basics.name,
      requiredWithinEntry: true,
      itemLabel: null,
    }),
    createField({
      sectionKey: 'basics',
      fieldKey: 'phone',
      path: 'basics.phone',
      rawValue: resume.basics.phone,
      itemLabel: null,
    }),
    createField({
      sectionKey: 'basics',
      fieldKey: 'email',
      path: 'basics.email',
      rawValue: resume.basics.email,
      itemLabel: null,
    }),
  ]

  if (isMeaningfulAtsValue(resume.basics.workYears)) {
    fields.push(
      createField({
        sectionKey: 'basics',
        fieldKey: 'workYears',
        path: 'basics.workYears',
        rawValue: resume.basics.workYears,
        itemLabel: null,
      }),
    )
  }

  resume.basics.customFields.forEach((field, index) => {
    if (!field || !isMeaningfulAtsValue(field.value)) return

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

export function createJobIntentSection(
  resume: ResumeSchema,
): AtsAssessmentSection | null {
  const fieldKeys = [
    'jobIntent',
    'intentionalCity',
    'expectedSalary',
    'dateEntry',
  ] as const

  const fields = fieldKeys.flatMap((fieldKey) => {
    const rawValue = resume.job_intent[fieldKey]

    if (!isMeaningfulAtsValue(rawValue)) return []

    return [
      createField({
        sectionKey: 'job_intent',
        fieldKey,
        path: `job_intent.${fieldKey}`,
        rawValue,
        itemLabel: null,
      }),
    ]
  })

  return createSingleItemSection('job_intent', fields)
}

export function createSelfEvaluationSection(
  resume: ResumeSchema,
): AtsAssessmentSection | null {
  if (!isMeaningfulAtsValue(resume.self_evaluation.content)) return null

  return createSingleItemSection('self_evaluation', [
    createField({
      sectionKey: 'self_evaluation',
      fieldKey: 'content',
      path: 'self_evaluation.content',
      rawValue: resume.self_evaluation.content,
      itemLabel: null,
    }),
  ])
}
