import type { ResumeToolContext } from './types'
import type { ResumeSchema } from '@/lib/schema'
import type { AtsEvaluationResult } from '@/pages/optimize/types'
import { getResumeEvidenceStats, isMeaningfulAtsValue } from '@/lib/ats'
import { fetchResumeDataForAnalysis } from '@/pages/optimize/utils'
import { SECTION_LABEL_MAP } from './const'
import { isStructurallyEmpty, normalizeDateRange, normalizeDateToken, normalizeInlineText, normalizeMultilineText } from './text'

interface ResumeSection {
  key: keyof ResumeSchema
  label: string
  lines: string[]
  text: string
}

function buildExperienceBlock(
  title: string,
  entries: Array<{
    heading: string
    subheading: string[]
    duration: string[]
    description: string
  }>,
) {
  const lines = entries.flatMap((entry, index) => {
    const metaParts = [...entry.subheading, ...entry.duration.filter(Boolean)]
    const metaLine = metaParts.filter(Boolean).join(' | ')
    const descriptionLines = normalizeMultilineText(entry.description)
      .split('\n')
      .filter(Boolean)
      .map(line => `- ${line}`)

    return [
      `${index + 1}. ${normalizeInlineText(entry.heading) || '未命名条目'}`,
      metaLine ? `   ${metaLine}` : '',
      ...descriptionLines.map(line => `   ${line}`),
    ].filter(Boolean)
  })

  return {
    label: title,
    lines,
    text: lines.join('\n'),
  }
}

export function getResumeSections(resume: ResumeSchema): ResumeSection[] {
  const candidateName = normalizeInlineText(resume.basics.name)
  const basicsLines = [
    ['姓名', candidateName.toLowerCase() === 'granular resume' ? '' : candidateName],
    ['电话', normalizeInlineText(resume.basics.phone)],
    ['邮箱', normalizeInlineText(resume.basics.email).toLowerCase()],
    ['工作年限', resume.basics.workYears === '不填' ? '' : resume.basics.workYears],
    ['出生年月', normalizeDateToken(resume.basics.birthMonth)],
    ['籍贯', resume.basics.nativePlace],
    ['民族', resume.basics.nation],
    ['政治面貌', resume.basics.politicalStatus === '不填' ? '' : resume.basics.politicalStatus],
  ]
    .filter(([, value]) => !isStructurallyEmpty(value))
    .map(([label, value]) => `${label}：${value}`)

  const customFieldLines = (resume.basics.customFields ?? [])
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map(item => ({
      label: normalizeInlineText(item.label),
      value: normalizeInlineText(item.value),
    }))
    .filter(item => item.label || item.value)
    .map(item => `${item.label || '自定义字段'}：${item.value}`)

  const jobIntentLines = [
    ['意向岗位', resume.job_intent.jobIntent],
    ['意向城市', resume.job_intent.intentionalCity],
    ['期望薪资', resume.job_intent.expectedSalary > 0 ? `${resume.job_intent.expectedSalary}` : ''],
    ['到岗时间', resume.job_intent.dateEntry === '不填' ? '' : resume.job_intent.dateEntry],
  ]
    .filter(([, value]) => !isStructurallyEmpty(value))
    .map(([label, value]) => `${label}：${value}`)

  const applicationInfoLines = [
    ['报考学校', resume.application_info.applicationSchool],
    ['报考专业', resume.application_info.applicationMajor],
  ]
    .filter(([, value]) => !isStructurallyEmpty(value))
    .map(([label, value]) => `${label}：${value}`)

  const educationLines = resume.edu_background.items
    .filter(item => [item.schoolName, item.professional, item.degree, item.duration, item.eduInfo]
      .some(isMeaningfulAtsValue))
    .flatMap((item, index) => {
      const meta = [
        normalizeInlineText(item.professional),
        item.degree === '不填' ? '' : item.degree,
        ...normalizeDateRange(item.duration).filter(Boolean),
      ].filter(Boolean)

      return [
        `${index + 1}. ${normalizeInlineText(item.schoolName) || '未填写学校'}`,
        meta.length > 0 ? `   ${meta.join(' | ')}` : '',
        ...normalizeMultilineText(item.eduInfo)
          .split('\n')
          .filter(Boolean)
          .map(line => `   - ${line}`),
      ].filter(Boolean)
    })

  const workBlock = buildExperienceBlock(
    '工作经历',
    resume.work_experience.items
      .filter(item => [item.companyName, item.position, item.workDuration, item.workInfo]
        .some(isMeaningfulAtsValue))
      .map(item => ({
        heading: item.companyName,
        subheading: [item.position],
        duration: normalizeDateRange(item.workDuration),
        description: item.workInfo,
      })),
  )

  const internshipBlock = buildExperienceBlock(
    '实习经历',
    resume.internship_experience.items
      .filter(item => [item.companyName, item.position, item.internshipDuration, item.internshipInfo]
        .some(isMeaningfulAtsValue))
      .map(item => ({
        heading: item.companyName,
        subheading: [item.position],
        duration: normalizeDateRange(item.internshipDuration),
        description: item.internshipInfo,
      })),
  )

  const campusBlock = buildExperienceBlock(
    '校园经历',
    resume.campus_experience.items
      .filter(item => [item.experienceName, item.role, item.duration, item.campusInfo]
        .some(isMeaningfulAtsValue))
      .map(item => ({
        heading: item.experienceName,
        subheading: [item.role],
        duration: normalizeDateRange(item.duration),
        description: item.campusInfo,
      })),
  )

  const projectBlock = buildExperienceBlock(
    '项目经历',
    resume.project_experience.items
      .filter(item => [item.projectName, item.participantRole, item.projectDuration, item.projectInfo]
        .some(isMeaningfulAtsValue))
      .map(item => ({
        heading: item.projectName,
        subheading: [item.participantRole],
        duration: normalizeDateRange(item.projectDuration),
        description: item.projectInfo,
      })),
  )

  const skillLines = [
    normalizeMultilineText(resume.skill_specialty.description),
    ...resume.skill_specialty.skills
      .filter(skill => normalizeInlineText(skill.label))
      .map(skill => `${skill.label} (${skill.proficiencyLevel})`),
  ].filter(Boolean)

  const certificateLines = [
    normalizeMultilineText(resume.honors_certificates.description),
    ...resume.honors_certificates.certificates
      .map(item => normalizeInlineText(item.name))
      .filter(Boolean)
      .map(name => `- ${name}`),
  ].filter(Boolean)

  const selfEvaluationLines = normalizeMultilineText(resume.self_evaluation.content)
    .split('\n')
    .filter(Boolean)

  const hobbyLines = [
    normalizeMultilineText(resume.hobbies.description),
    ...resume.hobbies.hobbies
      .map(item => normalizeInlineText(item.name))
      .filter(Boolean)
      .map(name => `- ${name}`),
  ].filter(Boolean)

  return [
    { key: 'basics' as const, label: SECTION_LABEL_MAP.basics, lines: [...basicsLines, ...customFieldLines] },
    { key: 'job_intent' as const, label: SECTION_LABEL_MAP.job_intent, lines: jobIntentLines },
    { key: 'application_info' as const, label: SECTION_LABEL_MAP.application_info, lines: applicationInfoLines },
    { key: 'edu_background' as const, label: SECTION_LABEL_MAP.edu_background, lines: educationLines },
    { key: 'work_experience' as const, label: workBlock.label, lines: workBlock.lines },
    { key: 'internship_experience' as const, label: internshipBlock.label, lines: internshipBlock.lines },
    { key: 'campus_experience' as const, label: campusBlock.label, lines: campusBlock.lines },
    { key: 'project_experience' as const, label: projectBlock.label, lines: projectBlock.lines },
    { key: 'skill_specialty' as const, label: SECTION_LABEL_MAP.skill_specialty, lines: skillLines },
    { key: 'honors_certificates' as const, label: SECTION_LABEL_MAP.honors_certificates, lines: certificateLines },
    { key: 'self_evaluation' as const, label: SECTION_LABEL_MAP.self_evaluation, lines: selfEvaluationLines },
    { key: 'hobbies' as const, label: SECTION_LABEL_MAP.hobbies, lines: hobbyLines },
  ].map(section => ({
    ...section,
    text: section.lines.join('\n'),
  }))
}

export function getAdvancedToolResumeSummary(resume: ResumeSchema) {
  const evidenceStats = getResumeEvidenceStats(resume)
  return {
    title: normalizeInlineText(resume.basics.name) || '未命名简历',
    jobIntent: normalizeInlineText(resume.job_intent.jobIntent) || '未填写求职意向',
    evidenceCount: evidenceStats.evidenceCount,
  }
}

interface LoadResumeContextOptions {
  atsConfig: AtsEvaluationResult | null
  resumeId: string
  resumeType: 'online' | 'offline'
}

export async function loadResumeToolContext(options: LoadResumeContextOptions): Promise<ResumeToolContext> {
  const resume = await fetchResumeDataForAnalysis(options.resumeId, options.resumeType === 'offline')

  return {
    resumeId: options.resumeId,
    resumeType: options.resumeType,
    resume,
    atsConfig: options.atsConfig,
  }
}
