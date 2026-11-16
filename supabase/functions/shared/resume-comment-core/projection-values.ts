import { createLegacyResumeEntryId } from './identity.ts'
import type { ProjectedNodeInput } from './types.ts'
import { normalizeCommentText } from './text.ts'
import { projectCommentRichTextBlocks } from './rich-text.ts'

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function readRecord(value: unknown): Record<string, unknown> {
  return isPlainRecord(value) ? value : {}
}

export function readString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export function readNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

export function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

export function normalizeProjectionReferenceDate(value: string | Date): string {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new TypeError('Invalid projection reference date')
    }

    return value.toISOString().slice(0, 10)
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)

  if (!match) {
    throw new Error('Invalid projection reference date')
  }

  const normalized = `${match[1]}-${match[2]}-${match[3]}`
  const date = new Date(`${normalized}T00:00:00Z`)

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== normalized
  ) {
    throw new Error('Invalid projection reference date')
  }

  return normalized
}

export function calculateAge(
  birthValue: unknown,
  referenceDate: string,
): string {
  const birth = readString(birthValue).trim()
  const match = /^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/.exec(birth)

  if (!match) {
    return ''
  }

  const [referenceYear, referenceMonth, referenceDay] = referenceDate
    .split('-')
    .map(Number)

  const birthYear = Number(match[1])
  const birthMonth = Number(match[2])
  const birthDay = Number(match[3] ?? 1)

  if (birthMonth < 1 || birthMonth > 12 || birthDay < 1 || birthDay > 31) {
    return ''
  }

  let age = referenceYear - birthYear

  if (
    referenceMonth < birthMonth ||
    (referenceMonth === birthMonth && referenceDay < birthDay)
  ) {
    age -= 1
  }

  return age >= 0 && age <= 150 ? `${age}岁` : ''
}

export function formatCommentDuration(value: unknown): string {
  const range = readArray(value)
  const startValue = readString(range[0]).trim()

  if (!startValue) {
    return ''
  }

  const normalizeYearMonth = (item: string) => {
    const match = /^(\d{4})[-/](\d{1,2})[-/]\d{1,2}$/.exec(item.trim())

    return match ? `${match[1]}-${match[2].padStart(2, '0')}` : item
  }

  const endValue = readString(range[1]).trim()

  return `${normalizeYearMonth(startValue)} - ${endValue ? normalizeYearMonth(endValue) : '至今'}`
}

export function buildEntryId(
  sectionKey: string,
  collectionKey: string,
  index: number,
  value: unknown,
  usedIds: Set<string>,
): string {
  const record = readRecord(value)
  const entryId = readString(record.entryId).trim()

  if (entryId && entryId.length <= 128 && !usedIds.has(entryId)) {
    usedIds.add(entryId)

    return entryId
  }

  const { entryId: _entryId, ...valueWithoutEntryId } = record

  const base = createLegacyResumeEntryId({
    sectionKey,
    collectionKey,
    index,
    value: valueWithoutEntryId,
  })

  let candidate = base
  let suffix = 1

  while (usedIds.has(candidate)) {
    candidate = `${base}_${suffix}`
    suffix += 1
  }

  usedIds.add(candidate)

  return candidate
}

export function pushTextNode(
  target: ProjectedNodeInput[],
  sectionKey: string,
  entryId: string,
  fieldKey: string,
  value: unknown,
  fallback = '',
) {
  const text = normalizeCommentText(readString(value).trim() || fallback)

  if (text) {
    target.push({ sectionKey, entryId, fieldKey, blocks: [{ text }] })
  }
}

export function pushRichTextNode(
  target: ProjectedNodeInput[],
  sectionKey: string,
  entryId: string,
  fieldKey: string,
  value: unknown,
) {
  const blocks = projectCommentRichTextBlocks(readString(value))

  if (blocks.length > 0) {
    target.push({ sectionKey, entryId, fieldKey, blocks })
  }
}
