import type { ResumeSchema } from '../../schema/resume/form/index.ts'
import { ATS_SECTION_LABELS } from '../constants.ts'
import type {
  AtsAssessmentField,
  AtsAssessmentInput,
  AtsAssessmentSection,
} from '../types.ts'
import {
  REPEATED_SECTIONS,
  createNamedListSection,
  createRepeatedSection,
  createSkillSection,
} from './collection-sections.ts'
import type { AtsSectionKey } from './fields.ts'
import { isMeaningfulAtsValue, normalizePlainText } from './fields.ts'
import {
  createBasicsSection,
  createJobIntentSection,
  createSelfEvaluationSection,
} from './personal-sections.ts'

export function buildAtsAssessmentInput(
  resume: ResumeSchema,
): AtsAssessmentInput {
  const candidateSections: Array<AtsAssessmentSection | null> = [
    createBasicsSection(resume),
    createJobIntentSection(resume),
    ...REPEATED_SECTIONS.map((config) => createRepeatedSection(resume, config)),
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

  const sections = candidateSections.filter(
    (section): section is AtsAssessmentSection => section !== null,
  )

  const evaluatedSectionKeys = new Set(sections.map((section) => section.key))

  const optionalSectionKeys = Object.keys(ATS_SECTION_LABELS).filter(
    (key) => key !== 'basics',
  ) as AtsSectionKey[]

  return {
    rubricVersion: '2.0',
    sections,
    scope: {
      evaluatedSections: sections.map((section) => section.label),
      ignoredEmptySections: optionalSectionKeys
        .filter((key) => !evaluatedSectionKeys.has(key))
        .map((key) => ATS_SECTION_LABELS[key]),
      hasCandidateName:
        isMeaningfulAtsValue(resume.basics.name) &&
        normalizePlainText(resume.basics.name).toLowerCase() !==
          'granular resume',
      hasContactMethod:
        isMeaningfulAtsValue(resume.basics.phone) ||
        isMeaningfulAtsValue(resume.basics.email),
    },
  }
}

export function flattenAssessmentFields(
  input: AtsAssessmentInput,
): AtsAssessmentField[] {
  return input.sections.flatMap((section) =>
    section.items.flatMap((item) => item.fields),
  )
}
