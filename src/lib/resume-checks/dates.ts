export type ParsedCheckDate =
  | { kind: 'empty' | 'current' | 'invalid' | 'unknown' }
  | {
      kind: 'date'
      min: number
      max: number
      precision: 'year' | 'month' | 'day'
    }

/** 不依赖 Date 的自动进位，非法月份、闰日必须保留为错误。 */
export function parseCheckDate(raw: string): ParsedCheckDate {
  const value = raw.trim()

  if (!value) return { kind: 'empty' }
  if (/^(至今|现在|当前|迄今|present|current|now|ongoing)$/i.test(value))
    return { kind: 'current' }

  const normalized = value
    .replace(/\s*(年|月|日|[-/.])\s*/g, '$1')
    .replace(/^(\d{4})年$/, '$1')
    .replace(/^(\d{4})年(\d{1,2})月$/, '$1-$2')
    .replace(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/, '$1-$2-$3')

  const match = /^(\d{4})(?:([-/.])(\d+)(?:\2(\d+))?)?$/.exec(normalized)

  if (!match) return { kind: 'unknown' }

  const year = Number(match[1])
  const month = match[3] ? Number(match[3]) : 1
  const day = match[4] ? Number(match[4]) : 1
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1])
    return { kind: 'invalid' }

  if ((match[3]?.length ?? 0) > 2 || (match[4]?.length ?? 0) > 2)
    return { kind: 'unknown' }

  const precision = match[4] ? 'day' : match[3] ? 'month' : 'year'
  const date = new Date(0)

  date.setUTCFullYear(year, month - 1, day)
  date.setUTCHours(0, 0, 0, 0)

  const min = date.getTime()

  if (precision === 'year') date.setUTCFullYear(year, 11, 31)
  if (precision === 'month') date.setUTCDate(days[month - 1])

  return { kind: 'date', min, max: date.getTime(), precision }
}
