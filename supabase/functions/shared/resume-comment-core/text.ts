export function normalizeCommentText(value: string): string {
  return value.normalize('NFC')
}

export function splitCommentGraphemes(value: string): string[] {
  const normalized = normalizeCommentText(value)

  return Array.from(
    new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(
      normalized,
    ),
    (segment) => segment.segment,
  )
}

export function countCommentGraphemes(value: string): number {
  return splitCommentGraphemes(value).length
}
