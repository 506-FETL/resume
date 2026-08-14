import {
  countCommentGraphemes,
  graphemeOffsetToUtf16Offset,
  splitCommentGraphemes,
} from './graphemes.ts'
import { normalizeCommentRichTextBlock } from './projection.ts'

export interface CommentDomPoint {
  container: Node
  offset: number
}

export interface CommentDomBlockProjection {
  element: HTMLElement
  ordinal: number
  text: string
  startGraphemeOffset: number
  endGraphemeOffset: number
}

export interface CommentDomNodeProjection {
  text: string
  blocks: CommentDomBlockProjection[]
}

const EMPTY_COMMENT_DOM_PROJECTION: CommentDomNodeProjection = {
  text: '',
  blocks: [],
}

const COMMENT_POINT_MARKERS = ['\uE000', '\uE001', '\u{F0000}'] as const

function serializeCommentDom(node: Node): string {
  if (node.nodeType === node.TEXT_NODE) {
    return node.nodeValue ?? ''
  }
  if (node.nodeType === node.ELEMENT_NODE && (node as Element).tagName === 'BR') {
    return '\n'
  }
  return Array.from(node.childNodes).map(serializeCommentDom).join('')
}

function serializedCommentDomAroundPoint(
  block: HTMLElement,
  container: Node,
  offset: number,
) {
  const before = block.ownerDocument.createRange()
  before.selectNodeContents(block)
  before.setEnd(container, offset)

  const after = block.ownerDocument.createRange()
  after.selectNodeContents(block)
  after.setStart(container, offset)

  return {
    before: serializeCommentDom(before.cloneContents()),
    after: serializeCommentDom(after.cloneContents()),
  }
}

function countCommonPrefixGraphemes(left: string, right: string) {
  const leftGraphemes = splitCommentGraphemes(left)
  const rightGraphemes = splitCommentGraphemes(right)
  const length = Math.min(leftGraphemes.length, rightGraphemes.length)
  let index = 0
  while (index < length && leftGraphemes[index] === rightGraphemes[index]) {
    index += 1
  }
  return index
}

export function commentDomPointToGraphemeOffset(
  block: HTMLElement,
  container: Node,
  offset: number,
) {
  const { before, after } = serializedCommentDomAroundPoint(block, container, offset)
  const marker = COMMENT_POINT_MARKERS.find(value => !before.includes(value) && !after.includes(value))
  if (!marker) {
    return null
  }
  const markedText = normalizeCommentRichTextBlock(`${before}${marker}${after}`)
  const markerIndex = markedText.indexOf(marker)
  if (markerIndex < 0) {
    return null
  }
  const normalizedBlock = normalizeCommentRichTextBlock(`${before}${after}`)
  return countCommonPrefixGraphemes(markedText.slice(0, markerIndex), normalizedBlock)
}

function collectCommentDomPointCandidates(block: HTMLElement) {
  const points: CommentDomPoint[] = [{ container: block, offset: 0 }]

  const visit = (node: Node) => {
    if (node.nodeType === node.TEXT_NODE) {
      const value = node.nodeValue ?? ''
      const graphemeCount = countCommentGraphemes(value)
      for (let index = 0; index <= graphemeCount; index += 1) {
        points.push({
          container: node,
          offset: graphemeOffsetToUtf16Offset(value, index),
        })
      }
      return
    }
    if (node.nodeType === node.ELEMENT_NODE && (node as Element).tagName === 'BR') {
      const parent = node.parentNode
      if (!parent)
        return
      const childIndex = Array.prototype.indexOf.call(parent.childNodes, node) as number
      points.push({ container: parent, offset: childIndex })
      points.push({ container: parent, offset: childIndex + 1 })
      return
    }
    node.childNodes.forEach(visit)
  }

  block.childNodes.forEach(visit)
  points.push({ container: block, offset: block.childNodes.length })

  return points.filter((point, index) => (
    index === 0
    || point.container !== points[index - 1]!.container
    || point.offset !== points[index - 1]!.offset
  ))
}

export function commentDomGraphemeOffsetToPoint(
  block: HTMLElement,
  targetOffset: number,
  affinity: 'start' | 'end',
): CommentDomPoint | null {
  if (!Number.isInteger(targetOffset) || targetOffset < 0) {
    return null
  }

  let match: CommentDomPoint | null = null
  for (const point of collectCommentDomPointCandidates(block)) {
    const offset = commentDomPointToGraphemeOffset(block, point.container, point.offset)
    if (offset === null)
      return null
    if (offset === targetOffset) {
      if (affinity === 'end')
        return point
      match = point
      continue
    }
    if (offset > targetOffset) {
      break
    }
  }
  return match
}

export function projectCommentDomNode(nodeElement: HTMLElement): CommentDomNodeProjection {
  const elements = [
    ...(nodeElement.matches('[data-comment-block-ordinal]') ? [nodeElement] : []),
    ...Array.from(nodeElement.querySelectorAll<HTMLElement>('[data-comment-block-ordinal]')),
  ].filter(element => element.closest('[data-comment-node-key]') === nodeElement)

  const ordered = elements
    .map(element => ({
      element,
      ordinal: Number(element.dataset.commentBlockOrdinal),
      text: normalizeCommentRichTextBlock(serializeCommentDom(element)),
    }))
    .sort((left, right) => left.ordinal - right.ordinal)

  if (
    ordered.length === 0
    || ordered.some((item, index) => (
      !Number.isInteger(item.ordinal)
      || item.ordinal !== index
      || item.text.length === 0
    ))
  ) {
    return EMPTY_COMMENT_DOM_PROJECTION
  }

  let cursor = 0
  const blocks = ordered.map((item, index) => {
    if (index > 0)
      cursor += 1
    const startGraphemeOffset = cursor
    cursor += countCommentGraphemes(item.text)
    return {
      ...item,
      startGraphemeOffset,
      endGraphemeOffset: cursor,
    }
  })

  return {
    text: blocks.map(block => block.text).join('\n'),
    blocks,
  }
}

export function findCommentDomBlockByOrdinal(
  projection: CommentDomNodeProjection,
  ordinal: number,
) {
  return projection.blocks.find(block => block.ordinal === ordinal) ?? null
}

export function findCommentDomBlockAtOffset(
  projection: CommentDomNodeProjection,
  offset: number,
) {
  return projection.blocks.find(block => (
    offset >= block.startGraphemeOffset
    && offset <= block.endGraphemeOffset
  )) ?? null
}
