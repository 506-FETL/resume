import type { AnchorOverlap, CommentAnchor, ResolvedCommentSelection } from './types.ts'
import { COMMENT_ANCHOR_CONTEXT_GRAPHEMES, COMMENT_HIDDEN_PAGE_SELECTOR, COMMENT_MEASUREMENT_SOURCE_SELECTOR } from '../const.ts'
import { sha256Hex } from './document.ts'
import { commentDomPointToGraphemeOffset, findCommentDomBlockByOrdinal, projectCommentDomNode } from './dom-projection.ts'
import { graphemeSlice } from './graphemes.ts'
import { normalizeCommentRichTextBlock } from './projection.ts'

interface ResolveCommentSelectionOptions {
  documentHash: string
  rejectMeasurementSource?: boolean
  rejectHiddenPage?: boolean
}

export interface CommentSelectionBoundaryIdentity {
  nodeKey: string
  blockOrdinal: number
}

export function areCommentSelectionBoundariesCompatible(
  start: CommentSelectionBoundaryIdentity,
  end: CommentSelectionBoundaryIdentity,
): boolean {
  return start.nodeKey === end.nodeKey
}

function toElement(node: Node): Element | null {
  return node.nodeType === Node.ELEMENT_NODE
    ? node as Element
    : node.parentElement
}

function readSelectionBoundary(node: Node) {
  const element = toElement(node)
  const blockElement = element?.closest<HTMLElement>('[data-comment-block-ordinal]') ?? null
  const nodeElement = element?.closest<HTMLElement>('[data-comment-node-key]') ?? null
  const blockOrdinal = Number(blockElement?.dataset.commentBlockOrdinal)
  const nodeKey = nodeElement?.dataset.commentNodeKey?.trim() ?? ''

  if (!blockElement || !nodeElement || !Number.isInteger(blockOrdinal) || blockOrdinal < 0 || !nodeKey) {
    return null
  }
  return { blockElement, nodeElement, blockOrdinal, nodeKey }
}

export function resolveCommentSelection(
  range: Range,
  options: ResolveCommentSelectionOptions,
): ResolvedCommentSelection | null {
  if (range.collapsed) {
    return null
  }
  if (!normalizeCommentRichTextBlock(range.toString())) {
    return null
  }

  const start = readSelectionBoundary(range.startContainer)
  const end = readSelectionBoundary(range.endContainer)
  if (
    !start
    || !end
    || start.nodeElement !== end.nodeElement
    || !areCommentSelectionBoundariesCompatible(start, end)
  ) {
    return null
  }

  if (
    options.rejectMeasurementSource !== false
    && start.nodeElement.closest(COMMENT_MEASUREMENT_SOURCE_SELECTOR)
  ) {
    return null
  }
  if (
    options.rejectHiddenPage !== false
    && start.nodeElement.closest(COMMENT_HIDDEN_PAGE_SELECTOR)
  ) {
    return null
  }

  const projection = projectCommentDomNode(start.nodeElement)
  const startBlock = findCommentDomBlockByOrdinal(projection, start.blockOrdinal)
  const endBlock = findCommentDomBlockByOrdinal(projection, end.blockOrdinal)
  if (
    !startBlock
    || !endBlock
    || startBlock.element !== start.blockElement
    || endBlock.element !== end.blockElement
  ) {
    return null
  }
  const localStart = commentDomPointToGraphemeOffset(
    start.blockElement,
    range.startContainer,
    range.startOffset,
  )
  const localEnd = commentDomPointToGraphemeOffset(
    end.blockElement,
    range.endContainer,
    range.endOffset,
  )
  if (localStart === null || localEnd === null) {
    return null
  }
  const startOffset = startBlock.startGraphemeOffset + localStart
  const endOffset = endBlock.startGraphemeOffset + localEnd
  if (startOffset >= endOffset) {
    return null
  }

  const exactQuote = graphemeSlice(projection.text, startOffset, endOffset)
  if (!exactQuote) {
    return null
  }

  const anchor: CommentAnchor = {
    nodeKey: start.nodeKey,
    startGraphemeOffset: startOffset,
    endGraphemeOffset: endOffset,
    blockOrdinal: start.blockOrdinal,
    exactQuote,
    prefix: graphemeSlice(
      projection.text,
      Math.max(0, startOffset - COMMENT_ANCHOR_CONTEXT_GRAPHEMES),
      startOffset,
    ),
    suffix: graphemeSlice(
      projection.text,
      endOffset,
      endOffset + COMMENT_ANCHOR_CONTEXT_GRAPHEMES,
    ),
    nodeTextHash: sha256Hex(projection.text),
    createdAtContentHash: options.documentHash,
  }

  return {
    anchor,
    range: range.cloneRange(),
    nodeElement: start.nodeElement,
    blockElement: start.blockElement,
  }
}

export function compareAnchorOverlap(left: CommentAnchor, right: CommentAnchor): AnchorOverlap {
  if (left.nodeKey !== right.nodeKey) {
    return 'none'
  }
  if (
    left.startGraphemeOffset === right.startGraphemeOffset
    && left.endGraphemeOffset === right.endGraphemeOffset
  ) {
    return 'exact'
  }
  if (
    left.startGraphemeOffset <= right.startGraphemeOffset
    && left.endGraphemeOffset >= right.endGraphemeOffset
  ) {
    return 'contains'
  }
  if (
    right.startGraphemeOffset <= left.startGraphemeOffset
    && right.endGraphemeOffset >= left.endGraphemeOffset
  ) {
    return 'contained_by'
  }
  if (
    left.startGraphemeOffset < right.endGraphemeOffset
    && right.startGraphemeOffset < left.endGraphemeOffset
  ) {
    return 'partial'
  }
  return 'none'
}
