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
import { flattenAssessmentFields, isMeaningfulAtsValue } from './assessment-input.ts'
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
  'number',
  'boolean',
  'html_string',
  'string_array',
  'object_array',
])
const USER_INPUT_PLACEHOLDER_PATTERN = /待补充\s*[：:]/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function readStringList(value: unknown, maxLength: number): string[] {
  if (!Array.isArray(value))
    return []

  return [...new Set(value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map(item => item.trim()))]
    .slice(0, maxLength)
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildFallbackSuggestion(
  field: AtsAssessmentField,
  fixSummary: string,
  steps: string[],
): Suggestion {
  const instruction = readString(steps[0], readString(fixSummary, `完善${field.locate.fieldLabel}`))
    .replace(/[。；;]+$/g, '')
    .slice(0, 48)
  const placeholder = `（待补充：${instruction}）`
  const { rawValue } = field
  const normalizedPath = field.locate.path.toLowerCase()

  if (Array.isArray(rawValue) && /(?:^|\.)skills$/.test(normalizedPath)) {
    return {
      kind: 'replace_value',
      valueType: 'skill_list',
      locate: field.locate,
      before: rawValue,
      after: rawValue.length > 0
        ? rawValue
        : [{
            entryId: 'ats_pending_skill',
            label: placeholder,
            proficiencyLevel: '一般',
            displayType: 'text',
          }],
      reason: '请先补充并确认真实技能信息，再应用这条修复建议。',
      fixed: false,
      requiresUserInput: true,
    }
  }

  if (Array.isArray(rawValue) && /(?:^|\.)(?:certificates|hobbies)$/.test(normalizedPath)) {
    return {
      kind: 'replace_value',
      valueType: normalizedPath.endsWith('.certificates') ? 'certificate_list' : 'object_array',
      locate: field.locate,
      before: rawValue,
      after: rawValue.length > 0
        ? rawValue
        : [{ entryId: `ats_pending_${normalizedPath.endsWith('.certificates') ? 'certificate' : 'hobby'}`, name: placeholder }],
      reason: '请先补充并确认真实信息，再应用这条修复建议。',
      fixed: false,
      requiresUserInput: true,
    }
  }

  if (Array.isArray(rawValue) && rawValue.every(item => typeof item === 'string')) {
    const isDateRange = /duration|dateRange|时间|日期/i.test(`${field.locate.path} ${field.locate.fieldLabel}`)
    return {
      kind: isDateRange ? 'normalize_date' : 'replace_value',
      valueType: 'string_array',
      locate: field.locate,
      before: rawValue,
      after: isDateRange
        ? ['（待补充：开始时间）', '（待补充：结束时间）']
        : [placeholder],
      reason: '请先补充并确认真实信息，再应用这条修复建议。',
      fixed: false,
      requiresUserInput: true,
    }
  }

  if (Array.isArray(rawValue) && rawValue.every(item => isRecord(item))) {
    return {
      kind: 'replace_value',
      valueType: 'object_array',
      locate: field.locate,
      before: rawValue,
      after: [{ content: placeholder }],
      reason: '请先补充并确认真实信息，再应用这条修复建议。',
      fixed: false,
      requiresUserInput: true,
    }
  }

  if (typeof rawValue === 'number' || typeof rawValue === 'boolean') {
    return {
      kind: 'replace_value',
      valueType: typeof rawValue === 'number' ? 'number' : 'boolean',
      locate: field.locate,
      before: rawValue,
      after: rawValue,
      reason: `请先填写并确认真实的${field.locate.fieldLabel}，再应用这条修复建议。`,
      fixed: false,
      requiresUserInput: true,
    }
  }

  const isHtmlField = typeof rawValue === 'string'
    && (/<[a-z][\s\S]*>/i.test(rawValue) || /(?:info|description|\.content)$/i.test(field.locate.path))

  return {
    kind: isHtmlField ? 'replace_text' : rawValue ? 'replace_value' : 'fill_field',
    valueType: isHtmlField ? 'html_string' : 'string',
    locate: field.locate,
    before: rawValue,
    after: isHtmlField ? `<p>${escapeHtml(placeholder)}</p>` : placeholder,
    reason: '请先补充并确认真实信息，再应用这条修复建议。',
    fixed: false,
    requiresUserInput: true,
  }
}

function valueContainsUserInputPlaceholder(value: unknown): boolean {
  if (typeof value === 'string')
    return USER_INPUT_PLACEHOLDER_PATTERN.test(value)
  if (Array.isArray(value))
    return value.some(valueContainsUserInputPlaceholder)
  if (isRecord(value))
    return Object.values(value).some(valueContainsUserInputPlaceholder)
  return false
}

function toInternalSuggestionValueType(valueType: ValueType, path: string): ValueType {
  if (valueType !== 'object_array')
    return valueType

  const normalizedPath = path.toLowerCase()
  if (/(?:^|\.)skills$/.test(normalizedPath))
    return 'skill_list'
  if (/(?:^|\.)certificates$/.test(normalizedPath))
    return 'certificate_list'
  return valueType
}

export function suggestionNeedsUserInput(suggestion: Suggestion): boolean {
  return suggestion.requiresUserInput === true || valueContainsUserInputPlaceholder(suggestion.after)
}

export function hasUnresolvedSuggestionInput(suggestions: Suggestion[]): boolean {
  return suggestions.some(suggestion => !isSuggestionReadyToApply(suggestion))
}

export function ensureAtsFindingsHaveSuggestions(findings: FindingsGroup | null | undefined): FindingsGroup {
  const source = findings ?? { high: [], medium: [], low: [] }
  const ensureFinding = (finding: Finding): Finding | null => {
    if ((finding.fix.suggestions ?? []).length > 0) {
      return {
        ...finding,
        fix: {
          ...finding.fix,
          suggestions: finding.fix.suggestions.map(suggestion => ({
            ...suggestion,
            valueType: toInternalSuggestionValueType(suggestion.valueType, suggestion.locate.path),
          })),
        },
      }
    }

    const evidence = finding.why.evidence.find(item => item.locate.path === finding.locate.path)
    if (!evidence)
      return null

    return {
      ...finding,
      fix: {
        ...finding.fix,
        suggestions: [buildFallbackSuggestion({
          locate: finding.locate,
          rawValue: evidence.rawValue,
          requiredWithinEntry: true,
        }, finding.fix.summary, finding.fix.steps)],
      },
    }
  }

  const ensureGroup = (group: Finding[]) => group
    .map(ensureFinding)
    .filter((finding): finding is Finding => finding !== null)

  return {
    high: ensureGroup(source.high ?? []),
    medium: ensureGroup(source.medium ?? []),
    low: ensureGroup(source.low ?? []),
  }
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
  const contactPaths = new Set(['basics.phone', 'basics.email'])
  const fields = flattenAssessmentFields(input).filter((field) => {
    if (!input.scope.hasContactMethod || !contactPaths.has(field.locate.path))
      return true

    return isMeaningfulAtsValue(field.rawValue)
  })

  return new Map(fields.map(field => [field.locate.path, field]))
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
  if (valueType === 'number')
    return typeof value === 'number' && Number.isFinite(value)

  if (valueType === 'boolean')
    return typeof value === 'boolean'

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

function isNonEmptyPlainText(value: unknown): value is string {
  if (typeof value !== 'string')
    return false
  return value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').trim().length > 0
}

function hasValidEntryId(value: Record<string, unknown>): boolean {
  return typeof value.entryId === 'string' && value.entryId.trim().length > 0
}

function isSuggestionTypeCompatibleWithBefore(suggestion: Suggestion): boolean {
  const { before, locate, valueType } = suggestion
  if (before === null || before === undefined)
    return true
  if (typeof before === 'string')
    return valueType === 'string' || valueType === 'html_string'
  if (typeof before === 'number')
    return valueType === 'number'
  if (typeof before === 'boolean')
    return valueType === 'boolean'
  if (Array.isArray(before) && before.length === 0) {
    const path = locate.path.toLowerCase()
    if (/(?:^|\.)skills$/.test(path))
      return valueType === 'skill_list'
    if (/(?:^|\.)certificates$/.test(path))
      return valueType === 'certificate_list'
    if (/(?:^|\.)hobbies$/.test(path))
      return valueType === 'object_array'
    return valueType === 'string_array' || valueType === 'date_range'
  }
  if (Array.isArray(before) && before.every(item => typeof item === 'string'))
    return valueType === 'string_array' || valueType === 'date_range'
  if (Array.isArray(before) && before.every(item => isRecord(item)))
    return valueType === 'object_array' || valueType === 'skill_list' || valueType === 'certificate_list'
  if (isRecord(before))
    return valueType === 'object' || valueType === 'skill_item'
  return false
}

export function isSuggestionReadyToApply(suggestion: Suggestion): boolean {
  if (suggestionNeedsUserInput(suggestion) || !isSuggestionTypeCompatibleWithBefore(suggestion))
    return false

  const { after, kind, locate, valueType } = suggestion
  if (kind === 'replace_text' && valueType !== 'html_string')
    return false
  if (kind === 'normalize_date' && valueType !== 'string_array' && valueType !== 'date_range')
    return false

  if (valueType === 'string' || valueType === 'html_string')
    return isNonEmptyPlainText(after)
  if (valueType === 'number')
    return typeof after === 'number' && Number.isFinite(after)
  if (valueType === 'boolean')
    return typeof after === 'boolean'
  if (valueType === 'string_array' || valueType === 'date_range') {
    return Array.isArray(after)
      && after.length > 0
      && (kind !== 'normalize_date' || after.length === 2)
      && after.every(item => typeof item === 'string' && item.trim().length > 0)
  }
  if (valueType === 'skill_list') {
    const levels = new Set(['一般', '良好', '熟练', '擅长', '精通'])
    const displayTypes = new Set(['text', 'percentage'])
    return Array.isArray(after) && after.length > 0 && after.every(item => (
      isRecord(item)
      && hasValidEntryId(item)
      && isNonEmptyPlainText(item.label)
      && levels.has(String(item.proficiencyLevel))
      && displayTypes.has(String(item.displayType))
    ))
  }
  if (valueType === 'certificate_list') {
    return Array.isArray(after) && after.length > 0 && after.every(item => (
      isRecord(item) && hasValidEntryId(item) && isNonEmptyPlainText(item.name)
    ))
  }
  if (valueType === 'object_array') {
    if (!Array.isArray(after) || after.length === 0 || !after.every(item => isRecord(item)))
      return false
    if (/(?:^|\.)hobbies$/.test(locate.path.toLowerCase())) {
      return after.every(item => hasValidEntryId(item) && isNonEmptyPlainText(item.name))
    }
    return true
  }
  if (valueType === 'object' || valueType === 'skill_item')
    return isRecord(after) && Object.keys(after).length > 0

  return false
}

function isValueTypeCompatibleWithField(valueType: ValueType, field: AtsAssessmentField): boolean {
  const { rawValue } = field
  if (typeof rawValue === 'string')
    return valueType === 'string' || valueType === 'html_string'
  if (typeof rawValue === 'number')
    return valueType === 'number'
  if (typeof rawValue === 'boolean')
    return valueType === 'boolean'
  if (Array.isArray(rawValue) && rawValue.length === 0) {
    return /(?:^|\.)(?:skills|certificates|hobbies)$/.test(field.locate.path.toLowerCase())
      ? valueType === 'object_array'
      : valueType === 'string_array'
  }
  if (Array.isArray(rawValue) && rawValue.every(item => typeof item === 'string'))
    return valueType === 'string_array'
  if (Array.isArray(rawValue) && rawValue.every(item => isRecord(item)))
    return valueType === 'object_array'
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
  if (!isValueTypeCompatibleWithField(normalizedValueType, field))
    return null
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
    valueType: toInternalSuggestionValueType(normalizedValueType, field.locate.path),
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
  if (evidence.length === 0 || !evidence.some(item => item.locate.path === field.locate.path))
    return null

  const suggestions = Array.isArray(rawFix.suggestions)
    ? rawFix.suggestions
        .map(item => normalizeSuggestion(item, catalog))
        .filter((item): item is Suggestion => item !== null)
    : []
  const fixSummary = readString(rawFix.summary, title)
  const steps = readStringList(rawFix.steps, 4)

  return {
    type: readString(rawFinding.type, 'content_issue').replace(/\W+/g, '_').toLowerCase(),
    title,
    locate: field.locate,
    why: {
      summary: readString(rawWhy.summary, title),
      evidence,
    },
    fix: {
      summary: fixSummary,
      steps,
      suggestions: suggestions.length > 0
        ? suggestions
        : [buildFallbackSuggestion(field, fixSummary, steps)],
    },
  }
}

function normalizeFindings(
  rawFindings: unknown,
  catalog: Map<string, AtsAssessmentField>,
): FindingsGroup {
  const source = isRecord(rawFindings) ? rawFindings : {}
  const prefixes: Record<Severity, string> = { high: 'H', medium: 'M', low: 'L' }

  const findings = Object.fromEntries(SEVERITIES.map((severity) => {
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

  return ensureAtsFindingsHaveSuggestions(findings)
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
