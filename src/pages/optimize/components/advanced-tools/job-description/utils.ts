import type { JobDescriptionComparisonResult } from './types'
import type { ResumeSchema } from '@/lib/schema'
import type { AnalysisState } from '@/pages/optimize/types'
import { isArray, isFinite, isNumber } from 'lodash'
import { SECTION_LABEL_MAP } from '../shared/const'
import { getResumeSections } from '../shared/resume'
import {
  isPlainObject,
  normalizeInlineText,
  normalizeMultilineText,
} from '../shared/text'

const MAX_KEYWORD_COUNT = 24
const MAX_INSIGHT_COUNT = 5

function clampPercentage(value: unknown) {
  const numeric = isNumber(value) ? value : Number(value)

  if (!isFinite(numeric)) {
    return 0
  }

  return Math.max(0, Math.min(100, Math.round(numeric)))
}

function normalizeStringList(value: unknown, limit: number) {
  if (!isArray(value)) {
    return []
  }

  const deduped = new Set<string>()
  const items: string[] = []

  value.forEach((entry) => {
    const normalized = normalizeInlineText(
      typeof entry === 'string' ? entry : String(entry ?? ''),
    )

    if (!normalized) {
      return
    }

    const key = normalized.toLowerCase()

    if (deduped.has(key)) {
      return
    }

    deduped.add(key)
    items.push(normalized)
  })

  return items.slice(0, limit)
}

function isResumeSectionKey(value: unknown): value is keyof ResumeSchema {
  return typeof value === 'string' && value in SECTION_LABEL_MAP
}

function buildSummaryFallback(matchScore: number, missingKeywords: string[]) {
  if (missingKeywords.length === 0) {
    return '当前简历与岗位描述的关键词承接比较完整，下一步更值得优化的是经历表达质量和结果量化。'
  }

  if (matchScore >= 70) {
    return `当前简历已经覆盖了多数核心要求，但仍有 ${missingKeywords.length} 个重点关键词没有被充分承接，建议针对性补强。`
  }

  if (matchScore >= 40) {
    return `当前简历和岗位描述存在一定相关性，但核心承接还不够稳定，尤其需要补齐 ${missingKeywords.slice(0, 3).join('、')} 等重点要求。`
  }

  return `当前简历与岗位描述的匹配度偏低，关键缺口集中在 ${missingKeywords.slice(0, 3).join('、')} 等岗位要求上。`
}

export function normalizeJobDescriptionComparisonResult(
  raw: unknown,
  resume: ResumeSchema,
): JobDescriptionComparisonResult {
  const payload = isPlainObject(raw) ? raw : {}
  const resumeSections = getResumeSections(resume)

  const extractedKeywords = normalizeStringList(
    payload.extractedKeywords,
    MAX_KEYWORD_COUNT,
  )

  const extractedKeywordSet = new Set(
    extractedKeywords.map((keyword) => keyword.toLowerCase()),
  )

  const matchedKeywords = normalizeStringList(
    payload.matchedKeywords,
    MAX_KEYWORD_COUNT,
  ).filter((keyword) => extractedKeywordSet.has(keyword.toLowerCase()))

  const matchedKeywordSet = new Set(
    matchedKeywords.map((keyword) => keyword.toLowerCase()),
  )

  const missingKeywords = extractedKeywords.filter(
    (keyword) => !matchedKeywordSet.has(keyword.toLowerCase()),
  )

  const derivedMatchScore =
    extractedKeywords.length > 0
      ? Math.round((matchedKeywords.length / extractedKeywords.length) * 100)
      : 0

  const rawSectionMatches = new Map<
    keyof ResumeSchema,
    Record<string, unknown>
  >()

  if (Array.isArray(payload.sectionMatches)) {
    payload.sectionMatches.forEach((section) => {
      if (!isPlainObject(section) || !isResumeSectionKey(section.sectionKey)) {
        return
      }

      rawSectionMatches.set(section.sectionKey, section)
    })
  }

  const sectionMatches = resumeSections
    .map((section) => {
      const rawSection = rawSectionMatches.get(section.key)

      const sectionMatchedKeywords = normalizeStringList(
        rawSection?.matchedKeywords,
        MAX_KEYWORD_COUNT,
      ).filter((keyword) => extractedKeywordSet.has(keyword.toLowerCase()))

      const matchedCount = sectionMatchedKeywords.length

      const coverage = rawSection
        ? clampPercentage(rawSection.coverage)
        : extractedKeywords.length > 0
          ? Math.round((matchedCount / extractedKeywords.length) * 100)
          : 0

      const analysis =
        normalizeMultilineText(
          typeof rawSection?.analysis === 'string' ? rawSection.analysis : '',
        ) ||
        (matchedCount > 0
          ? `该板块已经承接了 ${matchedCount} 个岗位关键词，可以继续补充更具体的职责和结果描述。`
          : '该板块与岗位描述的直接承接较弱，建议补充更贴近 JD 的关键词和成果表达。')

      return {
        sectionKey: section.key,
        sectionLabel: SECTION_LABEL_MAP[section.key],
        matchedCount,
        coverage,
        matchedKeywords: sectionMatchedKeywords,
        analysis,
      }
    })
    .sort((left, right) => right.matchedCount - left.matchedCount)

  const summary =
    normalizeMultilineText(
      typeof payload.summary === 'string' ? payload.summary : '',
    ) ||
    buildSummaryFallback(
      typeof payload.matchScore === 'number'
        ? clampPercentage(payload.matchScore)
        : derivedMatchScore,
      missingKeywords,
    )

  const strengths = normalizeStringList(payload.strengths, MAX_INSIGHT_COUNT)
  const risks = normalizeStringList(payload.risks, MAX_INSIGHT_COUNT)

  const recommendations = normalizeStringList(
    payload.recommendations,
    MAX_INSIGHT_COUNT,
  )

  return {
    summary,
    strengths:
      strengths.length > 0
        ? strengths
        : (() => {
            const fallbackStrengths = sectionMatches
              .filter((section) => section.matchedCount > 0)
              .slice(0, 3)
              .map(
                (section) =>
                  `${section.sectionLabel}对岗位要求有一定承接，可以继续强化证据表达。`,
              )

            return fallbackStrengths.length > 0
              ? fallbackStrengths
              : [
                  '当前简历已经成功纳入分析，建议结合更完整的 JD 信息继续判断岗位亮点。',
                ]
          })(),
    risks:
      risks.length > 0
        ? risks
        : missingKeywords.length > 0
          ? missingKeywords
              .slice(0, 3)
              .map(
                (keyword) =>
                  `简历里缺少对“${keyword}”的明确承接，容易影响岗位匹配判断。`,
              )
          : [
              '关键词覆盖已经比较完整，但仍建议继续优化经历的说服力和结果表达。',
            ],
    matchScore:
      typeof payload.matchScore === 'number'
        ? clampPercentage(payload.matchScore)
        : derivedMatchScore,
    extractedKeywords,
    matchedKeywords,
    missingKeywords,
    recommendations:
      recommendations.length > 0
        ? recommendations
        : missingKeywords.length > 0
          ? [
              `优先在最相关的经历里补齐这些关键词：${missingKeywords.slice(0, 5).join('、')}`,
              '把与 JD 最相关的项目或工作经历前置，并复用岗位描述中的核心术语。',
              '补充可验证的结果数据，例如提升比例、交付规模、覆盖范围或效率变化。',
            ]
          : [
              '当前关键词覆盖较完整，建议继续优化项目结果、业务影响和经历排序。',
            ],
    sectionMatches,
  }
}

export function hasJobDescriptionAnalysisFlow(
  state: AnalysisState,
  error: string | null,
) {
  return (
    state.status !== 'idle' &&
    (state.reasoning ||
      state.content ||
      Object.keys(state.logs).length > 0 ||
      error)
  )
}
