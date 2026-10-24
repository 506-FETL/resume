import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import {
  DAYJS_FULL_DATE_FORMATS,
  DAYJS_YEAR_MONTH_FORMATS,
  JD_STOPWORDS,
  NORMALIZED_PRESENT_TOKENS,
} from './const'

dayjs.extend(customParseFormat)

export function normalizeInlineText(value: string | null | undefined) {
  return (value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

export function normalizeMultilineText(value: string | null | undefined) {
  const lines = (value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => normalizeInlineText(line))

  const compacted: string[] = []

  lines.forEach((line) => {
    if (!line) {
      if (compacted.length > 0 && compacted[compacted.length - 1] !== '') {
        compacted.push('')
      }
      return
    }

    compacted.push(line)
  })

  while (compacted.length > 0 && compacted[compacted.length - 1] === '') {
    compacted.pop()
  }

  return compacted.join('\n')
}

export function normalizeDateToken(value: string | null | undefined) {
  const normalized = normalizeInlineText(value)

  if (!normalized) {
    return ''
  }

  if (NORMALIZED_PRESENT_TOKENS.has(normalized.toLowerCase())) {
    return '至今'
  }

  const fullDate = dayjs(normalized, [...DAYJS_FULL_DATE_FORMATS], true)
  if (fullDate.isValid()) {
    return fullDate.format('YYYY.MM.DD')
  }

  const yearMonth = dayjs(normalized, [...DAYJS_YEAR_MONTH_FORMATS], true)
  if (yearMonth.isValid()) {
    return yearMonth.format('YYYY.MM')
  }

  const fallback = dayjs(normalized)
  return fallback.isValid() ? fallback.format('YYYY.MM.DD') : normalized
}

export function normalizeDateRange(value: string[] | null | undefined) {
  const range = Array.isArray(value) ? value.slice(0, 2) : ['', '']
  while (range.length < 2) {
    range.push('')
  }

  return [normalizeDateToken(range[0]), normalizeDateToken(range[1])]
}

export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]'
}

export function isStructurallyEmpty(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true
  }

  if (typeof value === 'string') {
    return (
      value
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .trim() === ''
    )
  }

  if (typeof value === 'number') {
    return value === 0
  }

  if (Array.isArray(value)) {
    return (
      value.length === 0 || value.every((item) => isStructurallyEmpty(item))
    )
  }

  if (isPlainObject(value)) {
    return Object.values(value).every((item) => isStructurallyEmpty(item))
  }

  return false
}

export function extractKeywords(input: string) {
  const normalized = normalizeMultilineText(input).toLowerCase()
  const englishTokens = normalized.match(/[a-z][a-z0-9.+#/-]+/g) ?? []
  const chineseTokens = normalized.match(/[\u4E00-\u9FFF]{2,10}/g) ?? []
  const phraseTokens = normalized.split(/[\s,，。；;、|/()（）:：]+/g)

  const deduped = new Set<string>()
  const keywords: string[] = []

  ;[...phraseTokens, ...englishTokens, ...chineseTokens].forEach((token) => {
    const keyword = normalizeInlineText(token)
      .toLowerCase()
      .replace(/^[^\u4E00-\u9FFF\w]+|[^\u4E00-\u9FFF\w.+#/-]+$/g, '')

    if (
      !keyword ||
      keyword.length < 2 ||
      JD_STOPWORDS.has(keyword) ||
      /^\d+$/.test(keyword) ||
      deduped.has(keyword)
    ) {
      return
    }

    deduped.add(keyword)
    keywords.push(keyword)
  })

  return keywords.slice(0, 24)
}
