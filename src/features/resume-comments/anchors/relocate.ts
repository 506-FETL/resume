import type { CommentAnchor, CommentAnchorDocumentNode, RelocationResult } from './types.ts'
import { COMMENT_ANCHOR_CONTEXT_GRAPHEMES } from '../const.ts'
import { graphemeSlice, splitCommentGraphemes } from './graphemes.ts'

function findQuoteOffsets(text: string, quote: string): number[] {
  const haystack = splitCommentGraphemes(text)
  const needle = splitCommentGraphemes(quote)
  if (needle.length === 0 || needle.length > haystack.length) {
    return []
  }

  const matches: number[] = []
  for (let start = 0; start <= haystack.length - needle.length; start += 1) {
    if (needle.every((grapheme, index) => haystack[start + index] === grapheme)) {
      matches.push(start)
    }
  }
  return matches
}

function readContext(text: string, start: number, end: number) {
  return {
    prefix: graphemeSlice(
      text,
      Math.max(0, start - COMMENT_ANCHOR_CONTEXT_GRAPHEMES),
      start,
    ),
    suffix: graphemeSlice(
      text,
      end,
      end + COMMENT_ANCHOR_CONTEXT_GRAPHEMES,
    ),
  }
}

function contextMatches(anchor: CommentAnchor, text: string, start: number, end: number): boolean {
  const context = readContext(text, start, end)
  return context.prefix.endsWith(anchor.prefix) && context.suffix.startsWith(anchor.suffix)
}

function resolveBlockOrdinal(
  node: CommentAnchorDocumentNode,
  start: number,
  end: number,
): number | null {
  const block = node.blocks.find(item => (
    start >= item.startGraphemeOffset && end <= item.endGraphemeOffset
  ))
  return block?.ordinal ?? null
}

function moveAnchor(
  anchor: CommentAnchor,
  node: CommentAnchorDocumentNode,
  start: number,
): CommentAnchor | null {
  const quoteLength = splitCommentGraphemes(anchor.exactQuote).length
  const end = start + quoteLength
  const blockOrdinal = resolveBlockOrdinal(node, start, end)
  if (blockOrdinal === null) {
    return null
  }
  const context = readContext(node.text, start, end)
  return {
    ...anchor,
    startGraphemeOffset: start,
    endGraphemeOffset: end,
    blockOrdinal,
    prefix: context.prefix,
    suffix: context.suffix,
    nodeTextHash: node.nodeTextHash,
  }
}

export function relocateAnchor(
  anchor: CommentAnchor,
  nextNode: CommentAnchorDocumentNode | null | undefined,
): RelocationResult {
  if (!nextNode || nextNode.nodeKey !== anchor.nodeKey) {
    return { status: 'detached', reason: 'node_missing' }
  }

  const originalQuote = graphemeSlice(
    nextNode.text,
    anchor.startGraphemeOffset,
    anchor.endGraphemeOffset,
  )
  if (originalQuote === anchor.exactQuote) {
    const nextAnchor = moveAnchor(anchor, nextNode, anchor.startGraphemeOffset)
    if (!nextAnchor) {
      return { status: 'detached', reason: 'quote_missing' }
    }
    return {
      status: 'anchored',
      anchor: nextAnchor,
      moved: false,
      contextChanged: !contextMatches(
        anchor,
        nextNode.text,
        anchor.startGraphemeOffset,
        anchor.endGraphemeOffset,
      ),
    }
  }

  const offsets = findQuoteOffsets(nextNode.text, anchor.exactQuote)
  if (offsets.length === 0) {
    return { status: 'detached', reason: 'quote_missing' }
  }
  const quoteLength = splitCommentGraphemes(anchor.exactQuote).length
  const contextMatchesOffsets = offsets.filter(start => (
    contextMatches(anchor, nextNode.text, start, start + quoteLength)
  ))
  const selectedOffset = contextMatchesOffsets.length === 1
    ? contextMatchesOffsets[0]
    : offsets.length === 1
      ? offsets[0]
      : null

  if (selectedOffset === null) {
    return { status: 'detached', reason: 'ambiguous' }
  }
  const nextAnchor = moveAnchor(anchor, nextNode, selectedOffset)
  if (!nextAnchor) {
    return { status: 'detached', reason: 'quote_missing' }
  }
  return {
    status: 'anchored',
    anchor: nextAnchor,
    moved: true,
    contextChanged: contextMatchesOffsets.length !== 1,
  }
}
