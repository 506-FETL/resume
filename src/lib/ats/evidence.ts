import type { ResumeSchema } from '../schema/resume/form/index.ts'

export interface ResumeEvidenceStats {
  evidenceCount: number
  substantiveRatio: number
  impactEvidenceRatio: number
  positioningConsistency: number
}

interface EvidenceEntry {
  description: string
  heading: string
}

const IMPACT_PATTERN = /\d|%|百分|上线|落地|交付|推动|支撑|解决|优化|提升|增长|降低|节省|覆盖|转化|复用|稳定|性能|效率|规模|用户|业务/
const ACTION_PATTERN = /负责|主导|参与|设计|开发|实现|搭建|建设|推动|协调|交付|研究|分析|运营|管理|优化|解决|支撑/

function normalizeText(value: unknown): string {
  if (typeof value !== 'string')
    return ''

  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isMeaningful(value: unknown): boolean {
  if (Array.isArray(value))
    return value.some(item => isMeaningful(item))
  if (typeof value === 'number')
    return Number.isFinite(value) && value !== 0
  const normalized = normalizeText(value)
  return normalized !== '' && normalized !== '不填'
}

function buildEvidenceEntries(resume: ResumeSchema): EvidenceEntry[] {
  const educationEntries = resume.edu_background.items
    .filter(item => [item.schoolName, item.professional, item.degree, item.duration, item.eduInfo].some(isMeaningful))
    .map(item => ({
      heading: [item.schoolName, item.professional, item.degree].map(normalizeText).filter(Boolean).join(' '),
      description: normalizeText(item.eduInfo),
    }))

  const workEntries = resume.work_experience.items
    .filter(item => [item.companyName, item.position, item.workDuration, item.workInfo].some(isMeaningful))
    .map(item => ({
      heading: [item.companyName, item.position].map(normalizeText).filter(Boolean).join(' '),
      description: normalizeText(item.workInfo),
    }))

  const internshipEntries = resume.internship_experience.items
    .filter(item => [item.companyName, item.position, item.internshipDuration, item.internshipInfo].some(isMeaningful))
    .map(item => ({
      heading: [item.companyName, item.position].map(normalizeText).filter(Boolean).join(' '),
      description: normalizeText(item.internshipInfo),
    }))

  const campusEntries = resume.campus_experience.items
    .filter(item => [item.experienceName, item.role, item.duration, item.campusInfo].some(isMeaningful))
    .map(item => ({
      heading: [item.experienceName, item.role].map(normalizeText).filter(Boolean).join(' '),
      description: normalizeText(item.campusInfo),
    }))

  const projectEntries = resume.project_experience.items
    .filter(item => [item.projectName, item.participantRole, item.projectDuration, item.projectInfo].some(isMeaningful))
    .map(item => ({
      heading: [item.projectName, item.participantRole].map(normalizeText).filter(Boolean).join(' '),
      description: normalizeText(item.projectInfo),
    }))

  return [
    ...educationEntries,
    ...workEntries,
    ...internshipEntries,
    ...campusEntries,
    ...projectEntries,
  ]
}

function buildExperienceDescriptions(resume: ResumeSchema): string[] {
  return [
    ...resume.work_experience.items.map(item => item.workInfo),
    ...resume.internship_experience.items.map(item => item.internshipInfo),
    ...resume.campus_experience.items.map(item => item.campusInfo),
    ...resume.project_experience.items.map(item => item.projectInfo),
  ]
    .map(normalizeText)
    .filter(Boolean)
}

function extractPositioningTokens(value: string): Set<string> {
  const normalized = normalizeText(value).toLowerCase()
  const tokens = new Set<string>()

  normalized.match(/[a-z][a-z0-9+#.-]+/g)?.forEach(token => tokens.add(token))

  const chineseGroups = normalized.match(/[\u3400-\u9FFF]{2,}/g) ?? []
  chineseGroups.forEach((group) => {
    if (group.length <= 3) {
      tokens.add(group)
      return
    }

    for (let index = 0; index < group.length - 1; index += 1) {
      tokens.add(group.slice(index, index + 2))
    }
  })

  return tokens
}

function calculatePositioningConsistency(resume: ResumeSchema): number {
  const target = normalizeText(resume.job_intent.jobIntent)
  const supportingSources = [
    ...resume.work_experience.items.map(item => item.position),
    ...resume.internship_experience.items.map(item => item.position),
    ...resume.project_experience.items.map(item => item.participantRole),
    ...resume.campus_experience.items.map(item => item.role),
    ...resume.skill_specialty.skills.map(item => item.label),
  ].map(normalizeText).filter(Boolean)

  if (target) {
    const targetTokens = extractPositioningTokens(target)
    if (targetTokens.size === 0)
      return supportingSources.length > 0 ? 1 : 0

    const supportingTokens = extractPositioningTokens(supportingSources.join(' '))
    const matchedCount = [...targetTokens].filter(token => supportingTokens.has(token)).length
    return Math.min(1, matchedCount / targetTokens.size)
  }

  if (supportingSources.length === 0)
    return 0
  if (supportingSources.length === 1)
    return 1

  const tokenSets = supportingSources.map(extractPositioningTokens).filter(tokens => tokens.size > 0)
  if (tokenSets.length === 0)
    return 0

  const frequencies = new Map<string, number>()
  tokenSets.forEach((tokens) => {
    tokens.forEach(token => frequencies.set(token, (frequencies.get(token) ?? 0) + 1))
  })
  const dominantFrequency = Math.max(0, ...frequencies.values())
  return Math.min(1, dominantFrequency / tokenSets.length)
}

export function getResumeEvidenceStats(resume: ResumeSchema): ResumeEvidenceStats {
  const evidenceEntries = buildEvidenceEntries(resume)
  const experienceDescriptions = buildExperienceDescriptions(resume)
  const substantiveCount = experienceDescriptions
    .filter(text => text.length >= 24 && ACTION_PATTERN.test(text))
    .length
  const impactEvidenceCount = experienceDescriptions
    .filter(text => IMPACT_PATTERN.test(text))
    .length

  return {
    evidenceCount: evidenceEntries.length,
    substantiveRatio: experienceDescriptions.length === 0
      ? 0
      : substantiveCount / experienceDescriptions.length,
    impactEvidenceRatio: experienceDescriptions.length === 0
      ? 0
      : impactEvidenceCount / experienceDescriptions.length,
    positioningConsistency: calculatePositioningConsistency(resume),
  }
}
