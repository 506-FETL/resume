import type { AtsPreviewResult } from './types'
import type { ResumeSchema } from '@/lib/schema'
import { getResumeEvidenceStats } from '@/lib/ats'
import { getResumeSections } from '../shared/resume'
import { extractKeywords } from '../shared/text'

export function buildAtsPreview(resume: ResumeSchema): AtsPreviewResult {
  const sections = getResumeSections(resume)
  const evidenceStats = getResumeEvidenceStats(resume)
  const plainText = sections
    .filter(section => section.lines.length > 0)
    .map(section => [`[${section.label}]`, ...section.lines].join('\n'))
    .join('\n\n')

  const stats = {
    evidenceCount: evidenceStats.evidenceCount,
    lineCount: plainText ? plainText.split('\n').length : 0,
    characterCount: plainText.replace(/\s/g, '').length,
    keywordCount: new Set(extractKeywords(plainText)).size,
  }

  const warnings = [
    !resume.basics.phone?.trim() && !resume.basics.email?.trim()
      ? '手机号和邮箱都为空，ATS 与招聘方缺少可用的联系途径。'
      : '',
    evidenceStats.positioningConsistency < 0.4
      ? '现有内容的岗位定位较分散，建议统一经历重点与能力关键词。'
      : '',
    evidenceStats.impactEvidenceRatio < 0.35
      ? '现有经历的成果支撑偏少，建议补充真实交付、影响范围、问题解决情况或数据证据。'
      : '',
    resume.self_evaluation.content.trim().length > 180 ? '自我评价偏长，ATS 预览里会挤压更关键的经历信息。' : '',
  ].filter(Boolean)

  return {
    plainText,
    stats,
    warnings,
  }
}
