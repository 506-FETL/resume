import { normalizeCommentText } from './text.ts'
import type { CommentProjectedBlock } from './types.ts'
import { readString } from './projection-values.ts'

const HTML_BLOCK_TAGS = new Set([
  'p',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
])

function decodeHtmlEntity(entity: string): string {
  const normalized = entity.toLowerCase()

  const named: Record<string, string> = {
    '&amp;': '&',
    '&apos;': "'",
    '&gt;': '>',
    '&lt;': '<',
    '&nbsp;': ' ',
    '&quot;': '"',
  }

  if (named[normalized] !== undefined) {
    return named[normalized]
  }

  const decimal = /^&#(\d+);$/.exec(normalized)
  const hexadecimal = /^&#x([0-9a-f]+);$/.exec(normalized)

  const codePoint = decimal
    ? Number.parseInt(decimal[1], 10)
    : hexadecimal
      ? Number.parseInt(hexadecimal[1], 16)
      : Number.NaN

  if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
    return entity
  }

  return String.fromCodePoint(codePoint)
}

function decodeHtmlText(value: string): string {
  return value.replace(
    /&(?:amp|apos|gt|lt|nbsp|quot|#\d+|#x[0-9a-f]+);/giu,
    decodeHtmlEntity,
  )
}

export function normalizeCommentRichTextBlock(value: string): string {
  return normalizeCommentText(value)
    .replace(/[\t\f\v ]+/gu, ' ')
    .replace(/ *\n */gu, '\n')
    .trim()
}

export function projectCommentRichTextBlocks(
  html: string,
): CommentProjectedBlock[] {
  const source = readString(html).replace(
    /<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/giu,
    '',
  )

  const tokens = source.match(/<[^>]*>|[^<]+/gu) ?? []
  const blocks: CommentProjectedBlock[] = []
  let activeBlockTag: string | null = null
  let buffer = ''

  const flush = () => {
    const text = normalizeCommentRichTextBlock(buffer)

    if (text) {
      blocks.push({ text })
    }

    buffer = ''
  }

  for (const token of tokens) {
    if (!token.startsWith('<')) {
      buffer += decodeHtmlText(token)
      continue
    }

    const match = /^<\s*(?:(\/)\s*)?([a-z0-9]+)/iu.exec(token)

    if (!match) {
      continue
    }

    const closing = Boolean(match[1])
    const tag = match[2].toLowerCase()

    if (tag === 'br' && !closing) {
      buffer += '\n'
      continue
    }
    if (!HTML_BLOCK_TAGS.has(tag)) {
      continue
    }
    if (closing) {
      if (activeBlockTag === tag) {
        flush()
        activeBlockTag = null
      }

      continue
    }

    if (buffer) {
      flush()
    }

    activeBlockTag = tag
  }

  flush()

  return blocks
}
