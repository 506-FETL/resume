import type {
  AfterValue,
  AtsAssessmentMeta,
  AtsLlmDraft,
  AtsWritableFields,
  Evidence,
  Finding,
  FindingsGroup,
  FixChecklistItem,
  Priority,
  ScoreItem,
  ScoreKey,
  Scores,
  Severity,
  Suggestion,
  SuggestionKind,
  ValueType,
} from '../schema/ats.ts'
import type { AtsAssessmentField, AtsAssessmentInput } from './types.ts'
import { flattenAssessmentFields } from './assessment-input.ts'
import { ATS_SCORE_MAX } from './constants.ts'

const SCORE_KEYS = Object.keys(ATS_SCORE_MAX) as ScoreKey[]
const SEVERITIES: Severity[] = ['high', 'medium', 'low']
const SUGGESTION_KINDS = new Set<SuggestionKind>([
  'replace_text',
  'replace_value',
  'fill_field',
  'normalize_date',
])
const VALUE_TYPES = new Set<ValueType>([
  'string',
  'html_string',
  'string_array',
  'object_array',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function readStringList(value: unknown, maxLength: number): string[] {
  if (!Array.isArray(value))
    return []

  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map(item => item.trim())
    .slice(0, maxLength)
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)))
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right))
    return true

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length)
      return false
    return left.every((item, index) => deepEqual(item, right[index]))
  }

  if (isRecord(left) || isRecord(right)) {
    if (!isRecord(left) || !isRecord(right))
      return false
    const leftKeys = Object.keys(left).sort()
    const rightKeys = Object.keys(right).sort()
    if (!deepEqual(leftKeys, rightKeys))
      return false
    return leftKeys.every(key => deepEqual(left[key], right[key]))
  }

  return false
}

function buildFieldCatalog(input: AtsAssessmentInput): Map<string, AtsAssessmentField> {
  return new Map(flattenAssessmentFields(input).map(field => [field.locate.path, field]))
}

function resolveField(
  rawLocate: unknown,
  catalog: Map<string, AtsAssessmentField>,
): AtsAssessmentField | null {
  if (!isRecord(rawLocate) || typeof rawLocate.path !== 'string')
    return null
  return catalog.get(rawLocate.path) ?? null
}

function normalizeScores(rawScores: unknown): Scores {
  if (!isRecord(rawScores))
    throw new Error('ATS 评估结果缺少评分数据，请重新分析')

  return Object.fromEntries(SCORE_KEYS.map((key) => {
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
  })) as Scores
}

function isNonEmptyAfter(value: unknown, valueType: ValueType): value is AfterValue {
  if (valueType === 'string' || valueType === 'html_string') {
    if (typeof value !== 'string')
      return false
    const plainText = value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').trim()
    return plainText.length > 0
  }

  if (valueType === 'string_array') {
    return Array.isArray(value)
      && value.length > 0
      && value.every(item => typeof item === 'string' && item.trim().length > 0)
  }

  if (valueType === 'object_array') {
    return Array.isArray(value) && value.length > 0 && value.every(item => isRecord(item))
  }

  return false
}

function normalizeSuggestion(
  rawSuggestion: unknown,
  catalog: Map<string, AtsAssessmentField>,
): Suggestion | null {
  if (!isRecord(rawSuggestion))
    return null

  const field = resolveField(rawSuggestion.locate, catalog)
  if (!field || !deepEqual(rawSuggestion.before, field.rawValue))
    return null

  const kind = rawSuggestion.kind
  const valueType = rawSuggestion.valueType
  if (!SUGGESTION_KINDS.has(kind as SuggestionKind) || !VALUE_TYPES.has(valueType as ValueType))
    return null

  const normalizedKind = kind as SuggestionKind
  const normalizedValueType = valueType as ValueType
  if (!isNonEmptyAfter(rawSuggestion.after, normalizedValueType))
    return null

  if (normalizedKind === 'replace_text' && normalizedValueType !== 'html_string')
    return null
  if (normalizedKind === 'normalize_date') {
    if (normalizedValueType !== 'string_array' || !Array.isArray(rawSuggestion.after) || rawSuggestion.after.length !== 2)
      return null
  }

  return {
    kind: normalizedKind,
    valueType: normalizedValueType,
    locate: field.locate,
    before: field.rawValue as AfterValue,
    after: rawSuggestion.after,
    reason: readString(rawSuggestion.reason, '请结合真实情况确认后再应用。'),
    fixed: false,
  }
}

function normalizeEvidence(
  rawEvidence: unknown,
  catalog: Map<string, AtsAssessmentField>,
): Evidence | null {
  if (!isRecord(rawEvidence))
    return null

  const field = resolveField(rawEvidence.locate, catalog)
  const text = readString(rawEvidence.text)
  if (!field || !text || !deepEqual(rawEvidence.rawValue, field.rawValue))
    return null

  return {
    text,
    rawValue: field.rawValue,
    locate: field.locate,
  }
}

function normalizeFinding(
  rawFinding: unknown,
  catalog: Map<string, AtsAssessmentField>,
): Omit<Finding, 'id'> | null {
  if (!isRecord(rawFinding))
    return null

  const field = resolveField(rawFinding.locate, catalog)
  const title = readString(rawFinding.title)
  const rawWhy = isRecord(rawFinding.why) ? rawFinding.why : null
  const rawFix = isRecord(rawFinding.fix) ? rawFinding.fix : null
  if (!field || !title || !rawWhy || !rawFix)
    return null

  const evidence = Array.isArray(rawWhy.evidence)
    ? rawWhy.evidence
        .map(item => normalizeEvidence(item, catalog))
        .filter((item): item is Evidence => item !== null)
    : []
  if (evidence.length === 0)
    return null

  const suggestions = Array.isArray(rawFix.suggestions)
    ? rawFix.suggestions
        .map(item => normalizeSuggestion(item, catalog))
        .filter((item): item is Suggestion => item !== null)
    : []

  return {
    type: readString(rawFinding.type, 'content_issue').replace(/\W+/g, '_').toLowerCase(),
    title,
    locate: field.locate,
    why: {
      summary: readString(rawWhy.summary, title),
      evidence,
    },
    fix: {
      summary: readString(rawFix.summary, title),
      steps: readStringList(rawFix.steps, 4),
      suggestions,
    },
  }
}

function normalizeFindings(
  rawFindings: unknown,
  catalog: Map<string, AtsAssessmentField>,
): FindingsGroup {
  const source = isRecord(rawFindings) ? rawFindings : {}
  const prefixes: Record<Severity, string> = { high: 'H', medium: 'M', low: 'L' }

  return Object.fromEntries(SEVERITIES.map((severity) => {
    const rawGroup = Array.isArray(source[severity]) ? source[severity] : []
    const normalized = rawGroup
      .map(item => normalizeFinding(item, catalog))
      .filter((item): item is Omit<Finding, 'id'> => item !== null)
      .map((item, index): Finding => ({
        ...item,
        id: `${prefixes[severity]}-${String(index + 1).padStart(3, '0')}`,
      }))
    return [severity, normalized]
  })) as unknown as FindingsGroup
}

function flattenFindingsWithSeverity(findings: FindingsGroup) {
  return SEVERITIES.flatMap(severity => findings[severity].map(finding => ({ finding, severity })))
}

function buildFixChecklist(findings: FindingsGroup): FixChecklistItem[] {
  return flattenFindingsWithSeverity(findings)
    .slice(0, 6)
    .map(({ finding, severity }) => ({
      id: `check-${finding.id}`,
      title: finding.title,
      option: severity === 'high' ? 'required' : 'optional',
      isDone: false,
    }))
}

function buildNextActions(findings: FindingsGroup) {
  const priorityBySeverity: Record<Severity, Priority> = { high: 0, medium: 1, low: 2 }
  return flattenFindingsWithSeverity(findings)
    .slice(0, 4)
    .map(({ finding, severity }) => ({
      title: finding.fix.summary || finding.title,
      priority: priorityBySeverity[severity],
      locate: finding.locate,
    }))
}

function normalizeAssessmentMeta(
  rawMeta: unknown,
  input: AtsAssessmentInput,
): AtsAssessmentMeta {
  const meta = isRecord(rawMeta) ? rawMeta : {}
  const assessment = isRecord(meta.assessment) ? meta.assessment : {}
  const fallbackSignals = input.scope.evaluatedSections
    .filter(section => section !== '基本信息')
    .slice(0, 5)
    .map(section => `${section}已纳入本次评估`)

  return {
    candidateProfile: readString(assessment.candidateProfile, '基于现有内容综合判断的候选人'),
    inferredTarget: readString(assessment.inferredTarget, '未明确'),
    basisSummary: readString(assessment.basisSummary, '本次评分仅依据用户实际填写的内容。'),
    evaluatedSections: [...input.scope.evaluatedSections],
    evidenceSignals: readStringList(assessment.evidenceSignals, 5).length > 0
      ? readStringList(assessment.evidenceSignals, 5)
      : fallbackSignals,
  }
}

export function getAtsGrade(score: number): string {
  if (score >= 80)
    return '优秀'
  if (score >= 60)
    return '良好'
  if (score >= 40)
    return '中等'
  return '较低'
}

export function normalizeAtsEvaluationResult(
  draft: AtsLlmDraft,
  input: AtsAssessmentInput,
): AtsWritableFields {
  const scores = normalizeScores(draft.scores)
  const overallScore = SCORE_KEYS.reduce((sum, key) => sum + scores[key].score, 0)
  const catalog = buildFieldCatalog(input)
  const findings = normalizeFindings(draft.findings, catalog)
  const orderedFindings = flattenFindingsWithSeverity(findings)
  const rawReadability: Record<string, unknown> = isRecord(draft.readabilityIndex)
    ? draft.readabilityIndex
    : {}
  const derivedReadability = Math.max(1, Math.round(
    (scores.format_readability.score / scores.format_readability.max) * 10,
  ))
  const readabilityScore = readFiniteNumber(rawReadability.score)

  return {
    version: '2.0',
    meta: {
      document_version: 2,
      language: 'zh',
      generated_at: readString(draft.meta?.generated_at, new Date().toISOString()),
      mode: 'general_ats_check',
      inputDigest: readString(draft.meta?.inputDigest),
      rubricVersion: '2.0',
      assessment: normalizeAssessmentMeta(draft.meta, input),
    },
    readabilityIndex: {
      score: readabilityScore === null ? derivedReadability : clampInteger(readabilityScore, 1, 10),
      scale: { min: 1, max: 10 },
      summary: readString(rawReadability.summary, scores.format_readability.rationale),
    },
    scores,
    findings,
    fixChecklist: buildFixChecklist(findings),
    todo_items: orderedFindings.slice(0, 6).map(({ finding }) => finding.title),
    summary: {
      overall_score: overallScore,
      grade: getAtsGrade(overallScore),
      top_risks: orderedFindings.slice(0, 3).map(({ finding }) => finding.title),
      next_actions: buildNextActions(findings),
    },
  }
}
