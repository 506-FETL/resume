export const IMPORT_MAPPING_VERSION = 1

export const MAX_IMPORT_AI_CHARACTERS = 18_000

export const MAX_IMPORT_AI_LINES = 400

export const IMPORT_BASIC_FIELD_LIMITS = {
  name: 100,
  email: 254,
  phone: 40,
  city: 100,
  jobTitle: 120,
} as const

export const IMPORT_ENTRY_FIELD_LIMITS = {
  title: 200,
  subtitle: 200,
  degree: 80,
  startDate: 40,
  endDate: 40,
} as const

export const IMPORT_ENTRY_SECTIONS = [
  'edu_background',
  'work_experience',
  'internship_experience',
  'project_experience',
  'campus_experience',
] as const

export const IMPORT_TEXT_SECTIONS = [
  'skill_specialty',
  'honors_certificates',
  'self_evaluation',
  'hobbies',
  'job_intent',
] as const

export type EntrySection = (typeof IMPORT_ENTRY_SECTIONS)[number]

export type TextSection = (typeof IMPORT_TEXT_SECTIONS)[number]

/** Zero-based line and UTF-16 offsets; end is exclusive. */
export interface SourceSpan {
  line: number
  start: number
  end: number
}

export interface ImportMapping {
  basics: Partial<Record<keyof typeof IMPORT_BASIC_FIELD_LIMITS, SourceSpan>>
  entries: {
    section: EntrySection
    /** Zero-based, inclusive line range. */
    start: number
    end: number
    fields: Partial<Record<keyof typeof IMPORT_ENTRY_FIELD_LIMITS, SourceSpan>>
  }[]
  sections: {
    section: TextSection
    /** Zero-based, inclusive line range. */
    start: number
    end: number
  }[]
}

export function normalizeImportLines(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.normalize('NFKC').trim())
    .filter(Boolean)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]) {
  return Object.keys(value).every((key) => keys.includes(key))
}

function isBoundary(text: string, offset: number) {
  const previous = text.charCodeAt(offset - 1)
  const next = text.charCodeAt(offset)

  return !(
    previous >= 0xd800 &&
    previous <= 0xdbff &&
    next >= 0xdc00 &&
    next <= 0xdfff
  )
}

function validateSpan(
  value: unknown,
  lines: readonly string[],
  maxLength: number,
  firstLine: number,
  lastLine: number,
): value is SourceSpan {
  if (!isRecord(value) || !hasOnlyKeys(value, ['line', 'start', 'end']))
    return false
  if (
    !Number.isSafeInteger(value.line) ||
    !Number.isSafeInteger(value.start) ||
    !Number.isSafeInteger(value.end)
  )
    return false

  const { line, start, end } = value as unknown as SourceSpan

  if (line < firstLine || line > lastLine) return false

  const text = lines[line]

  if (
    typeof text !== 'string' ||
    start < 0 ||
    end <= start ||
    end > text.length ||
    end - start > maxLength ||
    !isBoundary(text, start) ||
    !isBoundary(text, end)
  )
    return false

  const source = text.slice(start, end)

  return source.trim() === source && source.length > 0
}

function validateFields(
  fields: unknown,
  limits: Record<string, number>,
  lines: readonly string[],
  start: number,
  end: number,
) {
  if (!isRecord(fields) || !hasOnlyKeys(fields, Object.keys(limits)))
    return false

  return Object.entries(fields).every(([key, value]) =>
    validateSpan(value, lines, limits[key], start, end),
  )
}

/** Reject malformed or overlapping mappings without throwing on model data. */
export function validateImportMapping(
  mapping: unknown,
  lines: readonly string[],
): mapping is ImportMapping {
  if (
    lines.length === 0 ||
    lines.length > MAX_IMPORT_AI_LINES ||
    lines.some((line) => typeof line !== 'string' || !line.trim()) ||
    lines.join('\n').length > MAX_IMPORT_AI_CHARACTERS ||
    !isRecord(mapping) ||
    !hasOnlyKeys(mapping, ['basics', 'entries', 'sections']) ||
    !validateFields(
      mapping.basics,
      IMPORT_BASIC_FIELD_LIMITS,
      lines,
      0,
      lines.length - 1,
    ) ||
    !Array.isArray(mapping.entries) ||
    !Array.isArray(mapping.sections) ||
    mapping.entries.length > 40 ||
    mapping.sections.length > 20
  )
    return false

  const occupied = new Set<number>()

  for (const [kind, ranges] of [
    ['entries', mapping.entries],
    ['sections', mapping.sections],
  ] as const) {
    for (const range of ranges) {
      if (
        !isRecord(range) ||
        !hasOnlyKeys(
          range,
          kind === 'entries'
            ? ['section', 'start', 'end', 'fields']
            : ['section', 'start', 'end'],
        ) ||
        typeof range.section !== 'string' ||
        !(
          kind === 'entries'
            ? (IMPORT_ENTRY_SECTIONS as readonly string[])
            : (IMPORT_TEXT_SECTIONS as readonly string[])
        ).includes(range.section) ||
        !Number.isSafeInteger(range.start) ||
        !Number.isSafeInteger(range.end)
      )
        return false

      const start = range.start as number
      const end = range.end as number

      if (start < 0 || end < start || end >= lines.length) return false
      if (
        kind === 'entries' &&
        (!validateFields(
          range.fields,
          IMPORT_ENTRY_FIELD_LIMITS,
          lines,
          start,
          end,
        ) ||
          !isRecord(range.fields) ||
          !range.fields.title)
      )
        return false

      for (let line = start; line <= end; line += 1) {
        if (occupied.has(line)) return false

        occupied.add(line)
      }
    }
  }

  return true
}
