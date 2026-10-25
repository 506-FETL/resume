import type { ResumeSchema } from '../schema/resume'
import type { ResumeParseResult } from './types'
import {
  normalizeImportLines,
  validateImportMapping,
  type ImportMapping,
  type EntrySection,
  type SourceSpan,
} from '../../../supabase/functions/shared/resume-import-contract'
import { resumeHtmlToText, textToResumeHtml } from './text'
import { readSectionHeading } from './sections'

const entryFields = {
  edu_background: ['schoolName', 'professional', 'duration', 'eduInfo'],
  work_experience: ['companyName', 'position', 'workDuration', 'workInfo'],
  internship_experience: [
    'companyName',
    'position',
    'internshipDuration',
    'internshipInfo',
  ],
  project_experience: [
    'projectName',
    'participantRole',
    'projectDuration',
    'projectInfo',
  ],
  campus_experience: ['experienceName', 'role', 'duration', 'campusInfo'],
} as const

const compact = (value: string) => value.normalize('NFKC').replace(/\s+/g, '')

function preferSourceField(
  local: string,
  incoming: string,
  sourceLine: string,
) {
  if (!incoming) return local

  // Preserve only a strict expansion of the same copied value. A different
  // field on the same line is not evidence that the local semantic role is right.
  return local.length > incoming.length &&
    compact(local).includes(compact(incoming)) &&
    sourceLine.includes(local)
    ? local
    : incoming
}

function dateValue(value: string) {
  if (/^(至今|现在|present|current)$/i.test(value)) return '至今'

  const match = value.match(
    /^(19\d{2}|20\d{2})(?:[年./-](0?[1-9]|1[0-2])月?)?年?$/,
  )

  return match
    ? `${match[1]}${match[2] ? `-${match[2].padStart(2, '0')}` : ''}`
    : value
}

function appendMissingText(current: string, incoming: string) {
  const existing = new Set(resumeHtmlToText(current).split('\n').map(compact))

  const additions = resumeHtmlToText(incoming)
    .split('\n')
    .filter((line) => {
      const key = compact(line)

      if (!key || existing.has(key)) return false

      existing.add(key)

      return true
    })

  return current + textToResumeHtml(additions.join('\n'))
}

export function hasResumeContent(content: ResumeSchema): boolean {
  return Boolean(
    content.basics.name ||
    content.basics.email ||
    content.basics.phone ||
    content.job_intent.jobIntent ||
    content.job_intent.intentionalCity ||
    Object.keys(entryFields).some((section) => {
      const key = section as EntrySection
      const fields = entryFields[key]

      return (content[key].items as unknown as Record<string, unknown>[]).some(
        (row) =>
          fields.some((field) => {
            const value = row[field]

            return Array.isArray(value)
              ? value.some(Boolean)
              : typeof value === 'string' &&
                  Boolean(resumeHtmlToText(value).trim())
          }),
      )
    }) ||
    [
      content.skill_specialty.description,
      content.honors_certificates.description,
      content.self_evaluation.content,
      content.hobbies.description,
    ].some((value) => resumeHtmlToText(value).trim()),
  )
}

/** Keep reliable local fields; a partial AI mapping must never erase them. */
export function mergeImportMapping(
  text: string,
  local: ResumeParseResult,
  mapping: ImportMapping,
): ResumeParseResult {
  const lines = normalizeImportLines(text)

  if (!validateImportMapping(mapping, lines))
    throw new Error('识别结果无法对应原文')

  const content = structuredClone(local.content)
  const sources = structuredClone(local.sources ?? { entries: {} })
  const covered: string[] = []

  const entries = mapping.entries.filter((entry) => {
    const titleLine = entry.fields.title!.line

    return !Object.values(sources.entries).some(
      (source) =>
        source.headerLine !== titleLine &&
        source.bodyLines.includes(titleLine) &&
        source.continuationLines.some((line) => line < titleLine) &&
        !entry.fields.startDate &&
        !entry.fields.endDate,
    )
  })

  const claimedByEntry = (
    entry: ImportMapping['entries'][number],
    line: number,
  ) => {
    if (line < entry.start || line > entry.end) return false

    const owner = Object.values(local.sources?.entries ?? {}).find(
      (source) => source.headerLine === entry.fields.title!.line,
    )

    return !owner || line === owner.headerLine || owner.bodyLines.includes(line)
  }

  const sourceBodyLine = (line: string) => {
    const heading = readSectionHeading(line)

    return heading ? heading.inlineText : line
  }

  // Move text modules by original line ownership, not by matching a keyword
  // in every description. Repeated words elsewhere belong to their own source.
  const textModuleLines = new Set<number>()

  for (const section of mapping.sections) {
    if (section.section === 'job_intent') continue

    for (let line = section.start; line <= section.end; line++)
      textModuleLines.add(line)
  }

  for (const [entryId, source] of Object.entries(sources.entries)) {
    const row = (
      content[source.section].items as unknown as Record<string, unknown>[]
    ).find((row) => row.entryId === entryId)

    const reassigned = (line: number) =>
      textModuleLines.has(line) ||
      entries.some(
        (entry) =>
          entry.fields.title!.line !== source.headerLine &&
          claimedByEntry(entry, line),
      )

    if (!row || !source.bodyLines.some(reassigned)) continue

    const infoKey = entryFields[source.section][3]

    source.bodyLines = source.bodyLines.filter((line) => !reassigned(line))
    row[infoKey] = textToResumeHtml(
      source.bodyLines
        .map((line) => sourceBodyLine(lines[line]))
        .filter(Boolean)
        .join('\n'),
    )
  }

  const fieldText = (span?: SourceSpan) =>
    span ? lines[span.line].slice(span.start, span.end) : ''

  for (const key of ['name', 'email', 'phone'] as const) {
    const value = fieldText(mapping.basics[key])

    if (!content.basics[key]) content.basics[key] = value
    if (value === content.basics[key]) covered.push(value)
  }

  for (const [key, target] of [
    ['city', 'intentionalCity'],
    ['jobTitle', 'jobIntent'],
  ] as const) {
    const value = fieldText(mapping.basics[key])

    if (!content.job_intent[target]) content.job_intent[target] = value
    if (value === content.job_intent[target]) covered.push(value)
  }

  for (const entry of entries) {
    const titleLine = entry.fields.title!.line

    const sourceMatch = Object.entries(sources.entries).find(
      ([, source]) => source.headerLine === titleLine,
    )

    // An explicit original module heading takes precedence over the model's
    // work/internship label; matching by source prevents cross-module copies.
    const targetSection = sourceMatch?.[1].section ?? entry.section

    const [titleKey, subtitleKey, durationKey, infoKey] =
      entryFields[targetSection]

    const title = fieldText(entry.fields.title)
    const subtitle = fieldText(entry.fields.subtitle)

    const duration = [
      fieldText(entry.fields.startDate),
      fieldText(entry.fields.endDate),
    ].map(dateValue)

    const rows = content[targetSection].items as unknown as Record<
      string,
      unknown
    >[]

    const sourceBlock = compact(
      lines.slice(entry.start, entry.end + 1).join('\n'),
    )

    const existing =
      (sourceMatch
        ? rows.find((row) => row.entryId === sourceMatch[0])
        : undefined) ??
      rows.find((row) => {
        const source = sources.entries[String(row.entryId)]

        if (source && source.headerLine !== titleLine) return false

        const dates = row[durationKey] as string[]
        const localTitle = compact(String(row[titleKey] || ''))
        const localSubtitle = compact(String(row[subtitleKey] || ''))

        return (
          (localTitle === compact(title) ||
            (localTitle.includes(compact(title)) &&
              sourceBlock.includes(localTitle))) &&
          (!row[subtitleKey] ||
            !subtitle ||
            localSubtitle === compact(subtitle) ||
            sourceBlock.includes(localSubtitle)) &&
          dates.every(
            (date, index) =>
              !date || !duration[index] || dateValue(date) === duration[index],
          )
        )
      })

    if (existing) {
      existing[titleKey] = preferSourceField(
        String(existing[titleKey] || ''),
        title,
        lines[titleLine],
      )

      if (entry.fields.subtitle)
        existing[subtitleKey] = preferSourceField(
          String(existing[subtitleKey] || ''),
          subtitle,
          lines[entry.fields.subtitle.line],
        )
    }

    // Remove only copied metadata, retaining every remaining source character.
    const entryCovered = new Set<number>()

    const details = lines
      .slice(entry.start, entry.end + 1)
      .map((line, offset) => {
        const sourceLine = entry.start + offset

        if (textModuleLines.has(sourceLine)) return ''
        if (
          sourceMatch &&
          (sourceLine < sourceMatch[1].start ||
            sourceLine > sourceMatch[1].end ||
            (sourceLine !== sourceMatch[1].headerLine &&
              !sourceMatch[1].bodyLines.includes(sourceLine)))
        )
          return ''

        const spans = Object.values(entry.fields).filter(
          (span) => span.line === entry.start + offset,
        )

        // A local, more complete title/role wins over a partial copied field.
        // Only expand a span where that local value actually occurs in source.
        if (existing) {
          for (const key of [titleKey, subtitleKey]) {
            const value = String(existing[key] || '')
            const start = value ? line.indexOf(value) : -1

            if (
              start >= 0 &&
              spans.some(
                (span) => span.start < start + value.length && span.end > start,
              )
            ) {
              spans.push({
                line: entry.start + offset,
                start,
                end: start + value.length,
              })
            }
          }
        }

        const merged: { start: number; end: number }[] = []

        for (const span of spans.sort((a, b) => a.start - b.start)) {
          const previous = merged.at(-1)

          if (previous && span.start <= previous.end)
            previous.end = Math.max(previous.end, span.end)
          else merged.push({ start: span.start, end: span.end })
        }

        let remaining = line

        for (const span of merged.reverse())
          remaining = remaining.slice(0, span.start) + remaining.slice(span.end)

        remaining = remaining.replace(
          /(?:公司名称|公司|单位名称|单位|项目名称|项目名|职位|岗位|学校|专业|学历|起止时间|时间)\s*[:：]\s*(?=$|[|｜])/g,
          '',
        )

        const bodyLine = sourceBodyLine(remaining).replace(
          /^[\s|｜·,，:：;；—–~～-]+|[\s|｜·,，:：;；—–~～-]+$/g,
          '',
        )

        if (bodyLine || spans.length || readSectionHeading(line))
          entryCovered.add(sourceLine)

        return bodyLine
      })
      .filter(Boolean)
      .join('\n')

    if (existing) {
      if (!existing[subtitleKey]) existing[subtitleKey] = subtitle

      existing[durationKey] = (existing[durationKey] as string[]).map(
        (date, i) => date || duration[i],
      )
      existing[infoKey] = appendMissingText(
        String(existing[infoKey] || ''),
        textToResumeHtml(details),
      )

      if (targetSection === 'edu_background' && existing.degree === '不填') {
        const degree = fieldText(entry.fields.degree)

        if (
          /^(初中|高中|中专|大专|本科|学士|硕士|博士|MBA|EMBA|其他)$/.test(
            degree,
          )
        )
          existing.degree = degree
        else if (degree)
          existing[infoKey] = appendMissingText(
            String(existing[infoKey]),
            textToResumeHtml(degree),
          )
      }
    } else {
      const row: Record<string, unknown> = {
        entryId: crypto.randomUUID(),
        hidden: false,
        [titleKey]: title,
        [subtitleKey]: subtitle,
        [durationKey]: duration,
        [infoKey]: textToResumeHtml(details),
      }

      if (targetSection === 'edu_background') {
        const degree = fieldText(entry.fields.degree)

        row.degree =
          /^(初中|高中|中专|大专|本科|学士|硕士|博士|MBA|EMBA|其他)$/.test(
            degree,
          )
            ? degree
            : '不填'

        // Unsupported degree labels remain visible in the original wording.
        if (degree && row.degree === '不填')
          row[infoKey] = textToResumeHtml(degree + '\n' + details)
      }

      rows.push(row)

      sources.entries[row.entryId as string] = {
        section: targetSection,
        start: entry.start,
        end: entry.end,
        headerLine: titleLine,
        bodyLines: Array.from(
          { length: entry.end - entry.start + 1 },
          (_, offset) => entry.start + offset,
        ).filter((line) => line !== titleLine && !textModuleLines.has(line)),
        continuationLines: [],
      }
    }

    covered.push(...Array.from(entryCovered, (line) => lines[line]))
  }

  for (const section of mapping.sections) {
    // Job intent is filled only from explicit basic spans; don't guess a title
    // from a multi-line objective paragraph or silently consume that paragraph.
    if (section.section === 'job_intent') continue

    const body = lines
      .slice(section.start, section.end + 1)
      .map(sourceBodyLine)
      .filter(Boolean)
      .join('\n')

    if (section.section === 'self_evaluation') {
      content.self_evaluation.content = appendMissingText(
        content.self_evaluation.content,
        textToResumeHtml(body),
      )
    } else {
      content[section.section].description = appendMissingText(
        content[section.section].description,
        textToResumeHtml(body),
      )
    }

    covered.push(...lines.slice(section.start, section.end + 1))
  }

  const consumed = new Set(covered.map(compact).filter(Boolean))

  const unassignedText = local.unassignedText
    .split('\n')
    .filter((line) => {
      const normalized = compact(line)

      return normalized && !consumed.has(normalized)
    })
    .join('\n')

  return { content, unassignedText, warnings: [], sources }
}
