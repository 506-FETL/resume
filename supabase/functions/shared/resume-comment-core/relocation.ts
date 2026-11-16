import { splitCommentGraphemes, countCommentGraphemes } from './text.ts'
import type {
  ResumeCommentAnchor,
  CommentAnchorDocumentNode,
  ResumeCommentRelocationResult,
} from './types.ts'

function commentGraphemeSlice(
  value: string,
  start: number,
  end?: number,
): string {
  return splitCommentGraphemes(value).slice(start, end).join('')
}

function findCommentQuoteOffsets(text: string, quote: string): number[] {
  const haystack = splitCommentGraphemes(text)
  const needle = splitCommentGraphemes(quote)

  if (needle.length === 0 || needle.length > haystack.length) {
    return []
  }

  const matches: number[] = []

  for (let start = 0; start <= haystack.length - needle.length; start += 1) {
    if (
      needle.every((grapheme, index) => haystack[start + index] === grapheme)
    ) {
      matches.push(start)
    }
  }

  return matches
}

function readCommentAnchorContext(text: string, start: number, end: number) {
  return {
    prefix: commentGraphemeSlice(text, Math.max(0, start - 32), start),
    suffix: commentGraphemeSlice(text, end, end + 32),
  }
}

function commentAnchorContextMatches(
  anchor: ResumeCommentAnchor,
  text: string,
  start: number,
  end: number,
): boolean {
  const context = readCommentAnchorContext(text, start, end)

  return (
    context.prefix.endsWith(anchor.prefix) &&
    context.suffix.startsWith(anchor.suffix)
  )
}

function moveResumeCommentAnchor(
  anchor: ResumeCommentAnchor,
  node: CommentAnchorDocumentNode,
  start: number,
  nextDocumentHash?: string,
): ResumeCommentAnchor | null {
  const end = start + countCommentGraphemes(anchor.exactQuote)

  const startBlock = node.blocks.find(
    (item) =>
      start >= item.startGraphemeOffset && start <= item.endGraphemeOffset,
  )

  const endBlock = node.blocks.find(
    (item) => end >= item.startGraphemeOffset && end <= item.endGraphemeOffset,
  )

  if (!startBlock || !endBlock) {
    return null
  }

  const context = readCommentAnchorContext(node.text, start, end)

  return {
    ...anchor,
    startGraphemeOffset: start,
    endGraphemeOffset: end,
    blockOrdinal: startBlock.ordinal,
    prefix: context.prefix,
    suffix: context.suffix,
    nodeTextHash: node.nodeTextHash,
    createdAtContentHash: nextDocumentHash ?? anchor.createdAtContentHash,
  }
}

export function relocateResumeCommentAnchor(
  anchor: ResumeCommentAnchor,
  nextNode: CommentAnchorDocumentNode | null | undefined,
  nextDocumentHash?: string,
): ResumeCommentRelocationResult {
  if (!nextNode || nextNode.nodeKey !== anchor.nodeKey) {
    return { status: 'detached', reason: 'node_missing' }
  }

  const originalQuote = commentGraphemeSlice(
    nextNode.text,
    anchor.startGraphemeOffset,
    anchor.endGraphemeOffset,
  )

  if (originalQuote === anchor.exactQuote) {
    const nextAnchor = moveResumeCommentAnchor(
      anchor,
      nextNode,
      anchor.startGraphemeOffset,
      nextDocumentHash,
    )

    if (!nextAnchor) {
      return { status: 'detached', reason: 'quote_missing' }
    }

    return {
      status: 'anchored',
      anchor: nextAnchor,
      moved: false,
      contextChanged: !commentAnchorContextMatches(
        anchor,
        nextNode.text,
        anchor.startGraphemeOffset,
        anchor.endGraphemeOffset,
      ),
    }
  }

  const offsets = findCommentQuoteOffsets(nextNode.text, anchor.exactQuote)

  if (offsets.length === 0) {
    return { status: 'detached', reason: 'quote_missing' }
  }

  const quoteLength = countCommentGraphemes(anchor.exactQuote)

  const matchingOffsets = offsets.filter((start) =>
    commentAnchorContextMatches(
      anchor,
      nextNode.text,
      start,
      start + quoteLength,
    ),
  )

  const selectedOffset =
    matchingOffsets.length === 1
      ? matchingOffsets[0]
      : offsets.length === 1
        ? offsets[0]
        : null

  if (selectedOffset === null) {
    return { status: 'detached', reason: 'ambiguous' }
  }

  const nextAnchor = moveResumeCommentAnchor(
    anchor,
    nextNode,
    selectedOffset,
    nextDocumentHash,
  )

  if (!nextAnchor) {
    return { status: 'detached', reason: 'quote_missing' }
  }

  return {
    status: 'anchored',
    anchor: nextAnchor,
    moved: true,
    contextChanged: matchingOffsets.length !== 1,
  }
}
