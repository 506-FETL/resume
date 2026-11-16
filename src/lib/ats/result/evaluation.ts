import type {
  AtsAssessmentMeta,
  AtsLlmDraft,
  AtsWritableFields,
  FindingsGroup,
  FixChecklistItem,
  Priority,
  ScoreItem,
  Scores,
  Severity,
} from '../../schema/ats.ts'
import { ATS_SCORE_MAX } from '../constants.ts'
import type { AtsAssessmentInput } from '../types.ts'
import { buildFieldCatalog } from './field-catalog.ts'
import { normalizeFindings } from './normalize-findings.ts'
import {
  clampInteger,
  isRecord,
  readFiniteNumber,
  readString,
  readStringList,
  SCORE_KEYS,
  SEVERITIES,
} from './values.ts'

export function normalizeScores(rawScores: unknown): Scores {
  if (!isRecord(rawScores))
    throw new Error('ATS 评估结果缺少评分数据，请重新分析')

  return Object.fromEntries(
    SCORE_KEYS.map((key) => {
      const rawItem = rawScores[key]

      if (!isRecord(rawItem))
        throw new Error(`ATS 评估结果缺少“${key}”评分，请重新分析`)

      const rawScore = readFiniteNumber(rawItem.score)

      if (rawScore === null)
        throw new Error(`ATS 评估结果中的“${key}”评分无效，请重新分析`)

      const item: ScoreItem = {
        score: clampInteger(rawScore, 0, ATS_SCORE_MAX[key]),
        max: ATS_SCORE_MAX[key],
        rationale: readString(rawItem.rationale),
      }

      return [key, item]
    }),
  ) as Scores
}

export function flattenFindingsWithSeverity(findings: FindingsGroup) {
  return SEVERITIES.flatMap((severity) =>
    findings[severity].map((finding) => ({ finding, severity })),
  )
}

export function buildFixChecklist(findings: FindingsGroup): FixChecklistItem[] {
  return flattenFindingsWithSeverity(findings)
    .slice(0, 6)
    .map(({ finding, severity }) => ({
      id: `check-${finding.id}`,
      title: finding.title,
      option: severity === 'high' ? 'required' : 'optional',
      isDone: false,
    }))
}

export function buildNextActions(findings: FindingsGroup) {
  const priorityBySeverity: Record<Severity, Priority> = {
    high: 0,
    medium: 1,
    low: 2,
  }

  return flattenFindingsWithSeverity(findings)
    .slice(0, 4)
    .map(({ finding, severity }) => ({
      title: finding.fix.summary || finding.title,
      priority: priorityBySeverity[severity],
      locate: finding.locate,
    }))
}

export function normalizeAssessmentMeta(
  rawMeta: unknown,
  input: AtsAssessmentInput,
): AtsAssessmentMeta {
  const meta = isRecord(rawMeta) ? rawMeta : {}
  const assessment = isRecord(meta.assessment) ? meta.assessment : {}

  const fallbackSignals = input.scope.evaluatedSections
    .filter((section) => section !== '基本信息')
    .slice(0, 5)
    .map((section) => `${section}已纳入本次评估`)

  return {
    candidateProfile: readString(
      assessment.candidateProfile,
      '基于现有内容综合判断的候选人',
    ),
    inferredTarget: readString(assessment.inferredTarget, '未明确'),
    basisSummary: readString(
      assessment.basisSummary,
      '本次评分仅依据用户实际填写的内容。',
    ),
    evaluatedSections: [...input.scope.evaluatedSections],
    evidenceSignals:
      readStringList(assessment.evidenceSignals, 5).length > 0
        ? readStringList(assessment.evidenceSignals, 5)
        : fallbackSignals,
  }
}

export function getAtsGrade(score: number): string {
  if (score >= 80) return '优秀'
  if (score >= 60) return '良好'
  if (score >= 40) return '中等'

  return '较低'
}

export function normalizeAtsEvaluationResult(
  draft: AtsLlmDraft,
  input: AtsAssessmentInput,
): AtsWritableFields {
  const scores = normalizeScores(draft.scores)

  const overallScore = SCORE_KEYS.reduce(
    (sum, key) => sum + scores[key].score,
    0,
  )

  const catalog = buildFieldCatalog(input)
  const findings = normalizeFindings(draft.findings, catalog)
  const orderedFindings = flattenFindingsWithSeverity(findings)

  const rawReadability: Record<string, unknown> = isRecord(
    draft.readabilityIndex,
  )
    ? draft.readabilityIndex
    : {}

  const derivedReadability = Math.max(
    1,
    Math.round(
      (scores.format_readability.score / scores.format_readability.max) * 10,
    ),
  )

  const readabilityScore = readFiniteNumber(rawReadability.score)

  return {
    version: '2.0',
    meta: {
      document_version: 2,
      language: 'zh',
      generated_at: readString(
        draft.meta?.generated_at,
        new Date().toISOString(),
      ),
      mode: 'general_ats_check',
      inputDigest: readString(draft.meta?.inputDigest),
      rubricVersion: '2.0',
      assessment: normalizeAssessmentMeta(draft.meta, input),
    },
    readabilityIndex: {
      score:
        readabilityScore === null
          ? derivedReadability
          : clampInteger(readabilityScore, 1, 10),
      scale: { min: 1, max: 10 },
      summary: readString(
        rawReadability.summary,
        scores.format_readability.rationale,
      ),
    },
    scores,
    findings,
    fixChecklist: buildFixChecklist(findings),
    todo_items: orderedFindings.slice(0, 6).map(({ finding }) => finding.title),
    summary: {
      overall_score: overallScore,
      grade: getAtsGrade(overallScore),
      top_risks: orderedFindings
        .slice(0, 3)
        .map(({ finding }) => finding.title),
      next_actions: buildNextActions(findings),
    },
  }
}
