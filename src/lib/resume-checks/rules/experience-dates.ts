import { resumeHtmlToText } from '@/lib/resume-import/text'
import { parseCheckDate } from '../dates'
import { isCheckSectionVisible } from '../targets'
import type { CheckSnapshot, CheckTarget } from '../types'
import { basicTarget } from './contact'
import type { NewIssue } from './issue-types'

export const experienceSections = [
  ['edu_background', 'schoolName', '学校名称', 'duration'],
  ['work_experience', 'companyName', '公司名称', 'workDuration'],
  ['internship_experience', 'companyName', '公司名称', 'internshipDuration'],
  ['project_experience', 'projectName', '项目名称', 'projectDuration'],
  ['campus_experience', 'experienceName', '活动名称', 'duration'],
] as const

export function hasContent(value: unknown): boolean {
  if (typeof value === 'string')
    return !!resumeHtmlToText(value).trim() && value !== '不填'
  if (Array.isArray(value)) return value.some(hasContent)

  return false
}

export function checkExperienceDates(
  snapshot: CheckSnapshot,
  fields: CheckTarget[],
  today: number,
  add: (issue: NewIssue) => void,
) {
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

  const birth = basicTarget(snapshot, 'birthMonth')
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
}
