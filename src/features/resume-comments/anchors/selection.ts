import type { AnchorOverlap, CommentAnchor, ResolvedCommentSelection } from './types.ts'
import { COMMENT_ANCHOR_CONTEXT_GRAPHEMES, COMMENT_HIDDEN_PAGE_SELECTOR, COMMENT_MEASUREMENT_SOURCE_SELECTOR } from '../const.ts'
import { sha256Hex } from './document.ts'
import { countCommentGraphemes, graphemeSlice, normalizeCommentText } from './graphemes.ts'

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
  return start.nodeKey === end.nodeKey && start.blockOrdinal === end.blockOrdinal
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

function textBeforePoint(root: HTMLElement, container: Node, offset: number): string {
  const range = root.ownerDocument.createRange()
  range.selectNodeContents(root)
  range.setEnd(container, offset)
  return normalizeCommentText(range.toString())
}

function collectNodeText(nodeElement: HTMLElement): {
  text: string
  blockStarts: Map<number, number>
} {
  const blockElements = [
    ...(nodeElement.matches('[data-comment-block-ordinal]') ? [nodeElement] : []),
    ...Array.from(
      nodeElement.querySelectorAll<HTMLElement>('[data-comment-block-ordinal]'),
    ),
  ].filter(element => element.closest('[data-comment-node-key]') === nodeElement)
  const ordered = blockElements
    .map(element => ({
      element,
      ordinal: Number(element.dataset.commentBlockOrdinal),
    }))
    .filter(item => Number.isInteger(item.ordinal) && item.ordinal >= 0)
    .sort((left, right) => left.ordinal - right.ordinal)

  const blockStarts = new Map<number, number>()
  let text = ''
  let cursor = 0
  ordered.forEach(({ element, ordinal }, index) => {
    const blockText = normalizeCommentText(element.textContent ?? '')
    if (index > 0) {
      text += '\n'
      cursor += 1
    }
    blockStarts.set(ordinal, cursor)
    text += blockText
    cursor += countCommentGraphemes(blockText)
  })
  return { text, blockStarts }
}

export function resolveCommentSelection(
  range: Range,
  options: ResolveCommentSelectionOptions,
): ResolvedCommentSelection | null {
  if (range.collapsed) {
    return null
  }

  const start = readSelectionBoundary(range.startContainer)
  const end = readSelectionBoundary(range.endContainer)
  if (
    !start
    || !end
    || start.nodeElement !== end.nodeElement
    || start.blockElement !== end.blockElement
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

  const { text: nodeText, blockStarts } = collectNodeText(start.nodeElement)
  const blockStart = blockStarts.get(start.blockOrdinal)
  if (blockStart === undefined) {
    return null
  }
  const startOffset = blockStart + countCommentGraphemes(
    textBeforePoint(start.blockElement, range.startContainer, range.startOffset),
  )
  const endOffset = blockStart + countCommentGraphemes(
    textBeforePoint(start.blockElement, range.endContainer, range.endOffset),
  )
  if (startOffset >= endOffset) {
    return null
  }

  const exactQuote = graphemeSlice(nodeText, startOffset, endOffset)
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
      nodeText,
      Math.max(0, startOffset - COMMENT_ANCHOR_CONTEXT_GRAPHEMES),
      startOffset,
    ),
    suffix: graphemeSlice(
      nodeText,
      endOffset,
      endOffset + COMMENT_ANCHOR_CONTEXT_GRAPHEMES,
    ),
    nodeTextHash: sha256Hex(nodeText),
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
  if (left.nodeKey !== right.nodeKey || left.blockOrdinal !== right.blockOrdinal) {
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
