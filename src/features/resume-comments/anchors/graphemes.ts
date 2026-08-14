import { countCommentGraphemes, normalizeCommentText, splitCommentGraphemes } from '../../../../supabase/functions/shared/resume-comment-core.ts'

export { countCommentGraphemes, normalizeCommentText, splitCommentGraphemes }

export interface TextLike {
  data: string
}

export interface TextPoint<TText extends TextLike = TextLike> {
  textNode: TText
  utf16Offset: number
}

const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

function clampOffset(value: number, max: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.min(Math.max(Math.trunc(value), 0), max)
}

export function graphemeSlice(value: string, start: number, end?: number): string {
  return splitCommentGraphemes(value).slice(start, end).join('')
}

export function utf16OffsetToGraphemeOffset(value: string, utf16Offset: number): number {
  const offset = clampOffset(utf16Offset, value.length)
  let graphemeOffset = 0

  for (const segment of graphemeSegmenter.segment(value)) {
    const segmentEnd = segment.index + segment.segment.length
    if (offset < segmentEnd) {
      return graphemeOffset
    }
    graphemeOffset += 1
  }

  return graphemeOffset
}

export function graphemeOffsetToUtf16Offset(value: string, graphemeOffset: number): number {
  const target = Math.max(0, Math.trunc(graphemeOffset))
  let index = 0

  for (const segment of graphemeSegmenter.segment(value)) {
    if (index === target) {
      return segment.index
    }
    index += 1
  }

  return value.length
}

export function textPointToGraphemeOffset<TText extends TextLike>(
  textNodes: readonly TText[],
  textNode: TText,
  utf16Offset: number,
): number {
  const targetIndex = textNodes.indexOf(textNode)
  if (targetIndex < 0) {
    throw new Error('Text node is outside the comment block')
  }

  const precedingLength = textNodes
    .slice(0, targetIndex)
    .reduce((total, node) => total + node.data.length, 0)
  const fullText = textNodes.map(node => node.data).join('')
  return utf16OffsetToGraphemeOffset(
    fullText,
    precedingLength + clampOffset(utf16Offset, textNode.data.length),
  )
}

export function graphemeOffsetToTextPoint<TText extends TextLike>(
  textNodes: readonly TText[],
  graphemeOffset: number,
): TextPoint<TText> {
  if (textNodes.length === 0) {
    throw new Error('Comment block has no text nodes')
  }

  const fullText = textNodes.map(node => node.data).join('')
  let remainingUtf16 = graphemeOffsetToUtf16Offset(fullText, graphemeOffset)

  for (const textNode of textNodes) {
    if (remainingUtf16 <= textNode.data.length) {
      return { textNode, utf16Offset: remainingUtf16 }
    }
    remainingUtf16 -= textNode.data.length
  }

  const last = textNodes.at(-1)!
  return { textNode: last, utf16Offset: last.data.length }
}
