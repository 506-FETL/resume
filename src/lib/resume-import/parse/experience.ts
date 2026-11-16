import type { EntrySection } from '../../../../supabase/functions/shared/resume-import-contract'
import type { ResumeSchema } from '../../schema/resume'
import { type Section } from '../sections'
import { textToResumeHtml } from '../text'
import type { ResumeParseResult } from '../types'

export const dateToken =
  '(?:19|20)\\d{2}(?:(?:[年./-])(?:1[0-2]|0?[1-9])(?!\\d)月?|年)?(?![\\d./])'

export const presentToken = '(?:至今|现在|present\\b|current\\b)'

export const dateRange = new RegExp(
  `(${dateToken})\\s*(?:(?:至|到|[-—–~～])\\s*|(?=${presentToken}))(${dateToken}|${presentToken})`,
  'i',
)

export function experienceTitle(line: string): string {
  return line.replace(dateRange, '').replace(/^[\s|｜·,，]+|[\s|｜·,，]+$/g, '')
}

export function isExperienceHeader(
  lines: string[],
  index: number,
  section: Section,
): boolean {
  const line = lines[index]
  const title = experienceTitle(line)

  if (
    !title ||
    title.length > 160 ||
    /(?:19|20)\d{2}[年./-]/.test(title) ||
    /^(?:[•●*]|负责|参与|完成|协助|推动|开发|维护|管理|主导|通过|实现|技术栈|项目职责|工作职责|职责|成果说明|工作成果|项目成果|项目描述|工作内容|项目内容|主要成果|主要工作)/.test(
      title,
    )
  )
    return false

  if (section === 'edu_background') return /(?:大学|学院|学校|中学)/.test(title)
  if (section === 'work_experience' || section === 'internship_experience') {
    if (
      /[:：]/.test(title) &&
      !/^(?:公司名称|公司|单位名称|单位|company)[:：]/i.test(title)
    )
      return false

    return (
      /^(?:公司(?:名称)?[:：]\s*)?[^|｜\t]+?(?:公司|研究院|事务所|集团|银行|医院)(?=$|[\s|｜\t])/.test(
        title,
      ) ||
      /^(?:公司名称|公司|单位名称|单位|company)[:：]\s*\S/i.test(title) ||
      // Explicit column boundaries plus dates also support short company names.
      (dateRange.test(line) &&
        title.split(/\s*[|｜\t]\s*|\s{2,}/).filter(Boolean).length >= 2)
    )
  }

  return (
    /^(?:项目名称|项目名|活动名称|社团名称)[:：]/.test(title) ||
    (dateRange.test(line) && title.length <= 60)
  )
}

export function normalizeDate(value: string): string {
  if (/^(至今|现在|present|current)$/i.test(value)) return '至今'

  const parts = value.match(/\d+/g) ?? []

  return parts.length > 1 ? `${parts[0]}-${parts[1].padStart(2, '0')}` : value
}

export function parseExperience(
  content: ResumeSchema,
  section: Section,
  lines: string[],
  unknown: string[],
  lineNumbers: number[],
  sourceEntries: NonNullable<ResumeParseResult['sources']>['entries'],
  continuationLines: number[],
) {
  const headerIndexes = Array.from(lines.keys()).filter((index) =>
    isExperienceHeader(lines, index, section),
  )

  if (!headerIndexes.length) {
    unknown.push(...lines)

    return
  }

  const isDateOnly = (index: number) =>
    Boolean(
      lines[index] &&
      dateRange.test(lines[index]) &&
      !experienceTitle(lines[index]),
    )

  const datesLead = isDateOnly(headerIndexes[0] - 1)
  const claimedDates = new Set<number>()

  // 标题只识别一次；独立日期只归属一个标题，切片后不再重新猜标题。
  const anchors = headerIndexes.map((headerIndex) => {
    const inlineRange = lines[headerIndex].match(dateRange)

    const candidates = datesLead
      ? [headerIndex - 1, headerIndex + 1]
      : [headerIndex + 1, headerIndex - 1]

    const dateIndex = inlineRange
      ? undefined
      : candidates.find(
          (index) => isDateOnly(index) && !claimedDates.has(index),
        )

    if (dateIndex !== undefined) claimedDates.add(dateIndex)

    return {
      headerIndex,
      start:
        dateIndex !== undefined && dateIndex < headerIndex
          ? dateIndex
          : headerIndex,
      range:
        inlineRange ??
        (dateIndex !== undefined ? lines[dateIndex].match(dateRange) : null),
    }
  })

  unknown.push(...lines.slice(0, anchors[0].start))

  for (const [index, anchor] of anchors.entries()) {
    const group = lines.slice(anchor.start, anchors[index + 1]?.start)
    const headerIndex = anchor.headerIndex - anchor.start
    const header = group[headerIndex]
    const range = anchor.range

    const duration = range
      ? [normalizeDate(range[1]), normalizeDate(range[2])]
      : ['', '']

    const title = header
      .replace(dateRange, '')
      .replace(/^[\s|｜·,，]+|[\s|｜·,，]+$/g, '')

    const parts = title
      .replace(
        /^(?:公司名称|公司|单位名称|单位|company|项目名称|项目名|活动名称|社团名称)[:：]\s*/i,
        '',
      )
      .split(/\s*[|｜\t]\s*|\s+·\s+|\s{2,}/)
      .filter((part) => Boolean(part) && !/^[·|｜]+$/.test(part))

    if (
      parts.length === 1 &&
      (section === 'work_experience' || section === 'internship_experience')
    ) {
      const company = title.match(/^(.+?(?:公司|研究院|事务所))\s+(.+)$/)

      if (company) parts.splice(0, 1, company[1], company[2])
    }

    const entryId = `import_${section}_${index}_${content[section as 'work_experience'].items.length}`

    const details = textToResumeHtml(
      group
        .filter(
          (_, lineIndex) =>
            lineIndex !== headerIndex &&
            !claimedDates.has(anchor.start + lineIndex),
        )
        .filter(Boolean)
        .join('\n'),
    )

    if (!title || (!range && parts.length < 2)) {
      unknown.push(...group)
      continue
    }

    const bodyLines = group
      .map((_, offset) => lineNumbers[anchor.start + offset])
      .filter(
        (_, offset) =>
          offset !== headerIndex && !claimedDates.has(anchor.start + offset),
      )

    sourceEntries[entryId] = {
      section: section as EntrySection,
      start: lineNumbers[anchor.start],
      end: lineNumbers[anchor.start + group.length - 1],
      headerLine: lineNumbers[anchor.headerIndex],
      bodyLines,
      continuationLines: continuationLines.filter(
        (line) =>
          line > lineNumbers[anchor.start] &&
          line <= lineNumbers[anchor.start + group.length - 1],
      ),
    }

    if (section === 'edu_background') {
      const degree = title.match(
        /(?:^|\s|[|｜])(初中|高中|中专|大专|本科|学士|硕士|博士|EMBA|MBA)(?=$|\s|[|｜])/i,
      )?.[1]

      const school = parts[0].match(/[^\s|｜]*?(?:大学|学院|学校|中学)/)?.[0]

      if (!school) {
        unknown.push(...group)
        continue
      }

      const remainder = title
        .replace(school, '')
        .replace(degree ?? /$^/, '')
        .replace(/^[\s|｜·]+|[\s|｜·]+$/g, '')

      content.edu_background.items.push({
        entryId,
        schoolName: school,
        professional: remainder,
        degree: ((degree && /^(mba|emba)$/i.test(degree)
          ? degree.toUpperCase()
          : degree) ??
          '不填') as ResumeSchema['edu_background']['items'][number]['degree'],
        duration,
        eduInfo: details,
      })
    } else if (
      section === 'work_experience' ||
      section === 'internship_experience'
    ) {
      const base = {
        entryId,
        companyName: parts[0],
        position: parts.slice(1).join(' | '),
      }

      if (section === 'work_experience')
        content.work_experience.items.push({
          ...base,
          workDuration: duration,
          workInfo: details,
        })
      else
        content.internship_experience.items.push({
          ...base,
          internshipDuration: duration,
          internshipInfo: details,
        })
    } else if (section === 'project_experience') {
      content.project_experience.items.push({
        entryId,
        projectName: parts[0],
        participantRole: parts.slice(1).join(' | '),
        projectDuration: duration,
        projectInfo: details,
      })
    } else if (section === 'campus_experience') {
      content.campus_experience.items.push({
        entryId,
        experienceName: parts[0],
        role: parts.slice(1).join(' | '),
        duration,
        campusInfo: details,
      })
    }
  }
}
