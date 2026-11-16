import type { ProjectedNodeInput } from './types.ts'
import { COMMENT_SECTION_ORDER } from './sections.ts'
import {
  readRecord,
  pushTextNode,
  calculateAge,
  readNumber,
  readArray,
  readString,
  pushRichTextNode,
} from './projection-values.ts'

export function projectSingletonSections(
  resume: Record<string, unknown>,
  referenceDate: string,
): Record<string, ProjectedNodeInput[]> {
  const sections = Object.fromEntries(
    COMMENT_SECTION_ORDER.map((sectionKey) => [
      sectionKey,
      [] as ProjectedNodeInput[],
    ]),
  ) as Record<string, ProjectedNodeInput[]>

  const basics = readRecord(resume.basics)

  pushTextNode(
    sections.basics,
    'basics',
    'singleton',
    'name',
    basics.name,
    '姓名',
  )

  pushTextNode(sections.basics, 'basics', 'singleton', 'phone', basics.phone)
  pushTextNode(sections.basics, 'basics', 'singleton', 'email', basics.email)

  pushTextNode(
    sections.basics,
    'basics',
    'singleton',
    'age',
    calculateAge(basics.birthMonth, referenceDate),
  )

  pushTextNode(
    sections.basics,
    'basics',
    'singleton',
    'gender',
    basics.gender === '不填' ? '' : basics.gender,
  )

  pushTextNode(
    sections.basics,
    'basics',
    'singleton',
    'workYears',
    basics.workYears === '不填' ? '' : basics.workYears,
  )

  pushTextNode(sections.basics, 'basics', 'singleton', 'nation', basics.nation)

  pushTextNode(
    sections.basics,
    'basics',
    'singleton',
    'height',
    readNumber(basics.heightCm) > 0 ? `${readNumber(basics.heightCm)}cm` : '',
  )

  pushTextNode(
    sections.basics,
    'basics',
    'singleton',
    'weight',
    readNumber(basics.weightKg) > 0 ? `${readNumber(basics.weightKg)}kg` : '',
  )

  pushTextNode(
    sections.basics,
    'basics',
    'singleton',
    'nativePlace',
    basics.nativePlace,
  )

  pushTextNode(
    sections.basics,
    'basics',
    'singleton',
    'maritalStatus',
    basics.maritalStatus === '不填' ? '' : basics.maritalStatus,
  )

  pushTextNode(
    sections.basics,
    'basics',
    'singleton',
    'politicalStatus',
    basics.politicalStatus === '不填' ? '' : basics.politicalStatus,
  )

  readArray(basics.customFields).forEach((item, index) => {
    const field = readRecord(item)
    const value = readString(field.value).trim()

    if (value) {
      pushTextNode(
        sections.basics,
        'basics',
        'singleton',
        `customFields.${index}`,
        value,
      )
    }
  })

  const jobIntent = readRecord(resume.job_intent)

  pushTextNode(
    sections.job_intent,
    'job_intent',
    'singleton',
    'jobIntent',
    jobIntent.jobIntent,
  )

  pushTextNode(
    sections.job_intent,
    'job_intent',
    'singleton',
    'intentionalCity',
    jobIntent.intentionalCity,
  )

  pushTextNode(
    sections.job_intent,
    'job_intent',
    'singleton',
    'expectedSalary',
    readNumber(jobIntent.expectedSalary) > 0
      ? `${readNumber(jobIntent.expectedSalary)}K`
      : '',
  )

  pushTextNode(
    sections.job_intent,
    'job_intent',
    'singleton',
    'dateEntry',
    jobIntent.dateEntry === '不填' ? '' : jobIntent.dateEntry,
  )

  const applicationInfo = readRecord(resume.application_info)

  pushTextNode(
    sections.application_info,
    'application_info',
    'singleton',
    'applicationSchool',
    applicationInfo.applicationSchool
      ? `申请院校：${readString(applicationInfo.applicationSchool)}`
      : '',
  )

  pushTextNode(
    sections.application_info,
    'application_info',
    'singleton',
    'applicationMajor',
    applicationInfo.applicationMajor
      ? `申请专业：${readString(applicationInfo.applicationMajor)}`
      : '',
  )

  const selfEvaluation = readRecord(resume.self_evaluation)

  pushRichTextNode(
    sections.self_evaluation,
    'self_evaluation',
    'singleton',
    'content',
    selfEvaluation.content,
  )

  return sections
}
