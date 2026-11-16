import { checkIssueSignature } from '../targets'
import type { CheckSnapshot, CheckTarget, ResumeCheckIssue } from '../types'
import type { ModelIssue, ProofreadCategory } from './contract'
import {
  CATEGORIES,
  invalidResult,
  isRecord,
  MAX_ISSUES,
  MAX_OUTPUT_LENGTH,
  MAX_TARGETS,
} from './contract'
import { validateCorrection } from './correction'

export function readModelIssue(value: unknown): ModelIssue {
  const keys = [
    'section',
    'path',
    'quote',
    'replacement',
    'category',
    'confidence',
  ]

  if (
    !isRecord(value) ||
    Object.keys(value).length !== keys.length ||
    keys.some((key) => !(key in value)) ||
    ['section', 'path', 'quote', 'replacement', 'category'].some(
      (key) => typeof value[key] !== 'string',
    ) ||
    !CATEGORIES.includes(value.category as ProofreadCategory) ||
    typeof value.confidence !== 'number' ||
    !Number.isFinite(value.confidence) ||
    value.confidence < 0 ||
    value.confidence > 1
  ) {
    invalidResult()
  }

  return value as unknown as ModelIssue
}

/** 严格解析模型返回，不修复畸形 JSON，也不把不可信输出转换成“没有问题”。 */
export function validateProofreadResponse(
  snapshot: CheckSnapshot,
  fields: CheckTarget[],
  content: string,
): ResumeCheckIssue[] {
  if (!content.trim() || content.length > MAX_OUTPUT_LENGTH) invalidResult()

  let parsed: unknown

  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error('AI 校对未返回完整的有效结果，请重试')
  }

  if (
    !isRecord(parsed) ||
    Object.keys(parsed).length !== 1 ||
    !Array.isArray(parsed.issues) ||
    parsed.issues.length > MAX_ISSUES
  ) {
    invalidResult()
  }

  const groups = new Map<string, ResumeCheckIssue>()
  let targetCount = 0

  for (const value of parsed.issues) {
    const issue = readModelIssue(value)

    const field = fields.find(
      (candidate) =>
        candidate.section === issue.section && candidate.path === issue.path,
    )

    if (!field || !issue.quote || !field.quote.includes(issue.quote))
      invalidResult()
    if (issue.confidence < 0.95) continue

    const canReplace = validateCorrection(issue, fields)

    const targets: CheckTarget[] = []
    let offset = 0
    let occurrence = 0

    while (offset <= field.quote.length - issue.quote.length) {
      const index = field.quote.indexOf(issue.quote, offset)

      if (index < 0) break

      const before = field.quote[index - 1] ?? ''
      const after = field.quote[index + issue.quote.length] ?? ''

      const insideToken =
        /[a-z]/i.test(issue.quote) &&
        (/[A-Za-z0-9_$+.#/@-]/.test(before) ||
          /[A-Za-z0-9_$+.#/@-]/.test(after))

      if (!insideToken)
        targets.push({ ...field, quote: issue.quote, occurrence })

      offset = index + issue.quote.length
      occurrence += 1
    }

    if (!targets.length) invalidResult()

    targetCount += targets.length

    if (targetCount > MAX_TARGETS) invalidResult()

    const kind =
      issue.category === 'technical_term' ||
      issue.category === 'text_consistency'
        ? 'term'
        : 'spelling'

    const key = JSON.stringify([
      field.section,
      kind,
      issue.quote,
      issue.replacement,
    ])

    const previous = groups.get(key)

    const allTargets = [...(previous?.targets ?? []), ...targets]
      .filter(
        (target, index, all) =>
          all.findIndex(
            (candidate) =>
              candidate.path === target.path &&
              candidate.occurrence === target.occurrence,
          ) === index,
      )
      .sort(
        (a, b) =>
          a.path.localeCompare(b.path) ||
          (a.occurrence ?? 0) - (b.occurrence ?? 0),
      )

    groups.set(key, {
      id: `ai:${encodeURIComponent(key)}`,
      section: field.section,
      kind,
      severity: 'warning',
      source: 'ai',
      title: !canReplace
        ? '用词待核对'
        : kind === 'term'
          ? '术语写法待核对'
          : '文字拼写待核对',
      detail: canReplace
        ? `“${issue.quote}”可能应为“${issue.replacement}”，请结合原文核对。`
        : `请核对“${issue.quote}”是否符合原意。AI 无法确认该处是否有误。`,
      targets: allTargets,
      signature: checkIssueSignature(snapshot, allTargets),
      resolved: false,
      ...(canReplace ? { replacement: issue.replacement } : {}),
    })
  }

  return [...groups.values()].sort((a, b) => a.id.localeCompare(b.id))
}
