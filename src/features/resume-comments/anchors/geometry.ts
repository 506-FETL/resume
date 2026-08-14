import { COMMENT_HIDDEN_PAGE_SELECTOR, COMMENT_MEASUREMENT_SOURCE_SELECTOR } from '../const.ts'

const COMMENT_PAGE_SELECTOR = '[data-resume-page-index]'
const COMMENT_PAGE_VIEWPORT_SELECTOR = '[data-resume-page-viewport]'
const LINE_TOLERANCE = 1.5
const ADJACENT_GAP_TOLERANCE = 2
const MIN_RECT_SIZE = 0.5

export interface CommentPageRect {
  pageIndex: number
  x: number
  y: number
  width: number
  height: number
}

interface RectLike {
  left: number
  top: number
  right: number
  bottom: number
}

function toElement(node: Node): Element | null {
  return node.nodeType === Node.ELEMENT_NODE
    ? node as Element
    : node.parentElement
}

function intersectRects(left: RectLike, right: RectLike): RectLike | null {
  const intersection = {
    left: Math.max(left.left, right.left),
    top: Math.max(left.top, right.top),
    right: Math.min(left.right, right.right),
    bottom: Math.min(left.bottom, right.bottom),
  }
  return intersection.right - intersection.left >= MIN_RECT_SIZE
    && intersection.bottom - intersection.top >= MIN_RECT_SIZE
    ? intersection
    : null
}

function readPageScale(page: HTMLElement, pageRect: DOMRect): number {
  const measuredScale = page.offsetWidth > 0 ? pageRect.width / page.offsetWidth : 0
  if (Number.isFinite(measuredScale) && measuredScale > 0) {
    return measuredScale
  }

  const scaleRoot = page.closest<HTMLElement>('[data-resume-scale]')
  const declaredScale = Number(scaleRoot?.dataset.resumeScale)
  return Number.isFinite(declaredScale) && declaredScale > 0 ? declaredScale : 1
}

function isSameLine(left: CommentPageRect, right: CommentPageRect): boolean {
  const leftMiddle = left.y + left.height / 2
  const rightMiddle = right.y + right.height / 2
  return Math.abs(leftMiddle - rightMiddle) <= LINE_TOLERANCE
    || Math.abs(left.y - right.y) <= LINE_TOLERANCE
}

export function mergeCommentPageRects(
  rects: readonly CommentPageRect[],
): CommentPageRect[] {
  const ordered = [...rects].sort((left, right) => (
    left.pageIndex - right.pageIndex
    || left.y - right.y
    || left.x - right.x
  ))

  return ordered.reduce<CommentPageRect[]>((merged, current) => {
    const previous = merged.at(-1)
    if (
      !previous
      || previous.pageIndex !== current.pageIndex
      || !isSameLine(previous, current)
      || current.x > previous.x + previous.width + ADJACENT_GAP_TOLERANCE
    ) {
      merged.push({ ...current })
      return merged
    }

    const left = Math.min(previous.x, current.x)
    const top = Math.min(previous.y, current.y)
    const right = Math.max(previous.x + previous.width, current.x + current.width)
    const bottom = Math.max(previous.y + previous.height, current.y + current.height)
    previous.x = left
    previous.y = top
    previous.width = right - left
    previous.height = bottom - top
    return merged
  }, [])
}

export function rangeToVisiblePageRects(range: Range): CommentPageRect[] {
  if (range.collapsed) {
    return []
  }

  const startElement = toElement(range.startContainer)
  const endElement = toElement(range.endContainer)
  const startPage = startElement?.closest<HTMLElement>(COMMENT_PAGE_SELECTOR) ?? null
  const endPage = endElement?.closest<HTMLElement>(COMMENT_PAGE_SELECTOR) ?? null
  if (
    !startPage
    || startPage !== endPage
    || startPage.closest(COMMENT_MEASUREMENT_SOURCE_SELECTOR)
    || startPage.closest(COMMENT_HIDDEN_PAGE_SELECTOR)
  ) {
    return []
  }

  const pageIndex = Number(startPage.dataset.resumePageIndex)
  const viewport = startPage.querySelector<HTMLElement>(COMMENT_PAGE_VIEWPORT_SELECTOR)
  if (!Number.isInteger(pageIndex) || pageIndex < 0 || !viewport) {
    return []
  }

  const pageRect = startPage.getBoundingClientRect()
  const viewportRect = viewport.getBoundingClientRect()
  const scale = readPageScale(startPage, pageRect)
  const rects = Array.from(range.getClientRects()).flatMap<CommentPageRect>((rect) => {
    const clipped = intersectRects(rect, viewportRect)
    if (!clipped) {
      return []
    }
    return [{
      pageIndex,
      x: (clipped.left - pageRect.left) / scale,
      y: (clipped.top - pageRect.top) / scale,
      width: (clipped.right - clipped.left) / scale,
      height: (clipped.bottom - clipped.top) / scale,
    }]
  })

  return mergeCommentPageRects(rects)
}
