import type { ORDERType } from '@/lib/schema'
import type { PreparationRecord } from '@/lib/resume-preparation/types'
import type {
  CheckSnapshot,
  CheckTarget,
  ResumeCheckIssue,
  ResumeCheckResult,
} from './types'
import { resumeHtmlToText } from '@/lib/resume-import/text'
import { parseCheckDate } from './dates'
import {
  checkIssueSignature,
  collectCheckFields,
  isCheckSectionVisible,
  readCheckTarget,
} from './targets'
import { findCheckTerms } from './terms'

type NewIssue = Omit<ResumeCheckIssue, 'signature' | 'resolved' | 'source'>

const experienceSections = [
  ['edu_background', 'schoolName', '学校名称', 'duration'],
  ['work_experience', 'companyName', '公司名称', 'workDuration'],
  ['internship_experience', 'companyName', '公司名称', 'internshipDuration'],
  ['project_experience', 'projectName', '项目名称', 'projectDuration'],
  ['campus_experience', 'experienceName', '活动名称', 'duration'],
] as const

function hasContent(value: unknown): boolean {
  if (typeof value === 'string')
    return !!resumeHtmlToText(value).trim() && value !== '不填'
  if (Array.isArray(value)) return value.some(hasContent)

  return false
}

/** 国际号码只检查通用结构与长度，不套用中国大陆手机前缀。 */
function plausiblePhone(raw: string): boolean {
  const value = raw.trim()
  const main = value.replace(/(?:\s*(?:转|分机|ext\.?|x|#)\s*\d{1,6})$/i, '')

  if (!/^(?:\+|00)?[\d\s().-]+$/.test(main)) return false
  if ((main.match(/\(/g)?.length ?? 0) !== (main.match(/\)/g)?.length ?? 0))
    return false

  const digits = main.replace(/\D/g, '').replace(/^00/, '')

  return digits.length >= 7 && digits.length <= 15 && !/^0+$/.test(digits)
}

function evidencePath(id: string, kind: string, section: ORDERType) {
  const prefix = `${kind}:${section}:`

  if (!id.startsWith(prefix)) return null

  try {
    return decodeURIComponent(id.slice(prefix.length))
  } catch {
    return null
  }
}

export function checkResume(
  snapshot: CheckSnapshot,
  record: PreparationRecord,
  now = new Date(),
): ResumeCheckResult {
  const issues: ResumeCheckIssue[] = []
  const aiEvidence: CheckTarget[] = []
  const fields = collectCheckFields(snapshot)
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())

  const add = (issue: NewIssue) => {
    const signature = checkIssueSignature(snapshot, issue.targets)

    issues.push({
      ...issue,
      source: 'rule',
      signature,
      resolved: record.resolutions[issue.id]?.signature === signature,
    })
  }

  const basicTarget = (path: string): CheckTarget => ({
    section: 'basics',
    path: `/${path}`,
    quote: resumeHtmlToText(
      String(snapshot.basics[path as keyof typeof snapshot.basics] ?? ''),
    ).trim(),
  })

  if (!snapshot.basics.name.trim()) {
    add({
      id: 'missing:name',
      section: 'basics',
      kind: 'missing',
      severity: 'error',
      title: '还没有填写姓名',
      detail: '填写用于求职的姓名。',
      targets: [basicTarget('name')],
    })
  }

  if (!snapshot.basics.phone.trim() && !snapshot.basics.email.trim()) {
    add({
      id: 'missing:contact',
      section: 'basics',
      kind: 'missing',
      severity: 'error',
      title: '还没有填写联系方式',
      detail: '电话和邮箱至少填写一项。',
      targets: [basicTarget('phone'), basicTarget('email')],
    })
  }

  const email = snapshot.basics.email.trim()

  if (
    email &&
    (!/^[^\s@<>.]+(?:\.[^\s@<>.]+)*@[^\s@<>.]+(?:\.[^\s@<>.]+)+$/.test(email) ||
      /(^|\.)-|-(@|\.|$)/.test(email.slice(email.lastIndexOf('@') + 1)))
  ) {
    add({
      id: 'contact:email',
      section: 'basics',
      kind: 'contact',
      severity: 'error',
      title: '邮箱格式不完整',
      detail: '检查邮箱中的 @、域名和空格。',
      targets: [basicTarget('email')],
    })
  }

  if (snapshot.basics.phone.trim() && !plausiblePhone(snapshot.basics.phone)) {
    add({
      id: 'contact:phone',
      section: 'basics',
      kind: 'contact',
      severity: 'warning',
      title: '请核对电话号码',
      detail: '号码的字符或长度不常见，请确认招聘方能够拨通。',
      targets: [basicTarget('phone')],
    })
  }

  const ranges: {
    group: string
    id: string
    startMax: number
    endMin: number
    targets: CheckTarget[]
  }[] = []

  for (const [section, nameKey, label, durationKey] of experienceSections) {
    if (!isCheckSectionVisible(snapshot, section)) continue

    const items = snapshot[section].items

    for (const [index, item] of items.entries()) {
      if (item.hidden) continue

      const row = item as unknown as Record<string, unknown>
      const entryId = item.entryId
      const identity = entryId ? `@${entryId}` : String(index)
      const path = `/items/${identity}`
      const title = String(row[nameKey] ?? '').trim()

      const target = (key: string, quote: string): CheckTarget => ({
        section,
        path: `${path}/${key}`,
        quote,
        ...(entryId ? { entryId } : {}),
      })

      const rowFields = fields.filter(
        (field) =>
          field.section === section && field.path.startsWith(`${path}/`),
      )

      if (
        !title &&
        Object.entries(row).some(
          ([key, value]) =>
            !['entryId', 'hidden', nameKey].includes(key) && hasContent(value),
        )
      ) {
        add({
          id: `missing:title:${section}:${identity}`,
          section,
          kind: 'missing',
          severity: 'error',
          title: `有一条经历还没填写${label}`,
          detail: `补填${label}，便于区分这条经历。`,
          targets: [target(nameKey, ''), ...rowFields],
        })
      }

      const values = row[durationKey]

      if (!Array.isArray(values)) continue

      const dateTargets = [0, 1].map((i) =>
        target(`${durationKey}/${i}`, String(values[i] ?? '')),
      )

      const parsed = dateTargets.map((field) => parseCheckDate(field.quote))

      if (parsed.filter((date) => date.kind === 'empty').length === 1) {
        add({
          id: `date:partial:${section}:${identity}`,
          section,
          kind: 'date',
          severity: 'warning',
          title: '起止日期还不完整',
          detail:
            '补充开始或结束年月；仍在进行的经历可以将结束日期填写为“至今”。',
          targets: dateTargets,
        })
      }

      parsed.forEach((date, i) => {
        const field = dateTargets[i]

        if (date.kind === 'empty') return

        if (date.kind === 'invalid') {
          add({
            id: `date:invalid:${section}:${identity}:${i}`,
            section,
            kind: 'date',
            severity: 'error',
            title: '日期中有无效的年月日',
            detail: '请检查月份、日期和闰年，例如 2 月没有 30 日。',
            targets: [field],
          })
        } else if (
          date.kind === 'unknown' ||
          (date.kind === 'current' && i === 0)
        ) {
          add({
            id: `date:unclear:${section}:${identity}:${i}`,
            section,
            kind: 'date',
            severity: 'warning',
            title: '请核对这处日期',
            detail: '这处日期无法明确判断起止关系，建议填写具体年月。',
            targets: [field],
          })
        } else if (date.kind === 'date' && date.min > today) {
          add({
            id: `date:future:${section}:${identity}:${i}`,
            section,
            kind: 'date',
            severity: 'warning',
            title: '这处日期在未来',
            detail: '如果是预计毕业、计划入职或尚未结束的安排，可以保留。',
            targets: [field],
          })
        }
      })

      const [start, end] = parsed

      if (start.kind !== 'date') continue

      const endMin =
        end.kind === 'current' ? today : end.kind === 'date' ? end.min : null

      const endMax =
        end.kind === 'current' ? today : end.kind === 'date' ? end.max : null

      if (endMax !== null && start.min > endMax) {
        add({
          id: `date:order:${section}:${identity}`,
          section,
          kind: 'date',
          severity: 'error',
          title: '结束日期早于开始日期',
          detail: '请核对这条经历的起止日期。',
          targets: dateTargets,
        })

        continue
      }

      if (
        endMax !== null &&
        end.kind === 'date' &&
        start.max > end.min &&
        start.precision !== end.precision
      ) {
        add({
          id: `date:ambiguous:${section}:${identity}`,
          section,
          kind: 'date',
          severity: 'warning',
          title: '起止日期的精度不同',
          detail: '目前无法明确先后关系，补齐年月后更容易核对。',
          targets: dateTargets,
        })
      }

      if (endMin !== null && start.max < endMin) {
        ranges.push({
          group:
            section === 'internship_experience' ? 'work_experience' : section,
          id: `${section}:${identity}`,
          startMax: start.max,
          endMin,
          targets: dateTargets,
        })
      }
    }
  }

  const birth = basicTarget('birthMonth')
  const birthDate = parseCheckDate(birth.quote)

  if (
    birthDate.kind === 'invalid' ||
    birthDate.kind === 'unknown' ||
    birthDate.kind === 'current' ||
    (birthDate.kind === 'date' && birthDate.min > today)
  ) {
    add({
      id: 'date:birth',
      section: 'basics',
      kind: 'date',
      severity: birthDate.kind === 'invalid' ? 'error' : 'warning',
      title: birthDate.kind === 'invalid' ? '出生日期无效' : '请核对出生日期',
      detail: '检查出生年月是否填写正确。',
      targets: [birth],
    })
  }

  ranges.forEach((range, index) => {
    ranges.slice(index + 1).forEach((other) => {
      if (
        range.group !== other.group ||
        Math.max(range.startMax, other.startMax) >=
          Math.min(range.endMin, other.endMin)
      )
        return

      add({
        id: `date:overlap:${[range.id, other.id].sort().join(':')}`,
        section: range.targets[0].section,
        kind: 'date',
        severity: 'warning',
        title: '两条经历的时间有重叠',
        detail: '兼职、并行项目或交接期可能出现重叠，请核对后保留或调整。',
        targets: [...range.targets, ...other.targets],
      })
    })
  })

  const termGroups = new Map<
    string,
    {
      from: string
      to: string
      kind: 'term' | 'spelling'
      style?: boolean
      targets: CheckTarget[]
    }
  >()

  fields.forEach((field) => {
    if (
      /\/(?:phone|email|birthMonth|(?:work|internship|project)?[Dd]uration\/\d+)$/.test(
        field.path,
      )
    )
      return

    findCheckTerms(
      field.quote,
      readCheckTarget(snapshot, field) ?? undefined,
    ).forEach((term) => {
      const key = `${term.kind}:${term.from}`
      const group = termGroups.get(key) ?? { ...term, targets: [] }

      group.targets.push({
        ...field,
        quote: term.from,
        occurrence: term.occurrence,
      })

      termGroups.set(key, group)
    })
  })

  termGroups.forEach((group, id) => {
    add({
      id,
      section: group.targets[0].section,
      kind: group.kind,
      severity: group.style ? 'warning' : 'error',
      title: group.style
        ? `请核对“${group.from}”的名称写法`
        : `“${group.from}”建议改为“${group.to}”`,
      detail: group.style
        ? `如果这里指产品或技术名称，常见写法为“${group.to}”；代码与命令可以保留原文。`
        : group.kind === 'term'
          ? '这处技术名称与常用正式拼写不一致。'
          : '这处常见词语有错字。',
      targets: group.targets,
      ...(group.style ? {} : { replacement: group.to }),
    })
  })

  const examples = new Map<string, CheckTarget[]>()

  for (const evidence of record.evidence) {
    if (!isCheckSectionVisible(snapshot, evidence.section)) continue

    const path = evidencePath(evidence.id, evidence.kind, evidence.section)
    const evidenceText = resumeHtmlToText(evidence.text).trim()

    const candidates = fields.filter(
      (field) =>
        field.section === evidence.section &&
        (path ? field.path === path : field.quote === evidenceText),
    )

    // 老记录没有身份时，重复原文无法唯一确认归属。
    if (!path && candidates.length !== 1) continue

    const field = candidates[0]

    if (!field || !evidenceText || field.quote !== evidenceText) continue

    if (evidence.kind === 'ai') {
      if (
        !aiEvidence.some(
          (candidate) =>
            candidate.section === field.section &&
            candidate.path === field.path,
        )
      )
        aiEvidence.push(field)

      continue
    }

    const key = `example:${field.section}:${field.entryId ?? 'section'}`
    const group = examples.get(key) ?? []

    if (!group.some((candidate) => candidate.path === field.path))
      group.push(field)

    examples.set(key, group)
  }

  examples.forEach((targets, id) => {
    add({
      id,
      section: targets[0].section,
      kind: 'example',
      severity: 'warning',
      title: '这处内容仍与示例相同',
      detail: '核对这条经历或模块中的示例是否符合你的情况；确认后可以保留。',
      targets,
    })
  })

  return { issues, aiEvidence }
}
