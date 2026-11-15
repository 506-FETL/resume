import type {
  CommentAnchor,
  CommentAnchorDocumentResult,
} from '@/features/resume-comments/anchors/types'
import { resolveCommentSelection } from '@/features/resume-comments/anchors/selection'
import { graphemeSlice } from '@/features/resume-comments/anchors/graphemes'
import {
  COMMENT_HIDDEN_PAGE_SELECTOR,
  COMMENT_MEASUREMENT_SOURCE_SELECTOR,
} from '@/features/resume-comments/const'

function visibleCanvasViewport(element: HTMLElement): DOMRect | null {
  const page = element.closest('[data-resume-page-index]')

  const viewport = page
    ?.querySelector<HTMLElement>('[data-resume-page-viewport]')
    ?.getBoundingClientRect()

  if (!viewport) return null

  let { left, top, right, bottom } = viewport
  let parent = element.parentElement

  while (parent && parent !== page) {
    if (
      parent.matches('[data-resume-region-viewport], [data-resume-page-clip]')
    ) {
      const clip = parent.getBoundingClientRect()

      left = Math.max(left, clip.left)
      top = Math.max(top, clip.top)
      right = Math.min(right, clip.right)
      bottom = Math.min(bottom, clip.bottom)
    }

    parent = parent.parentElement
  }

  return right > left && bottom > top
    ? new DOMRect(left, top, right - left, bottom - top)
    : null
}

export function hasVisibleCanvasText(element: HTMLElement): boolean {
  const viewport = visibleCanvasViewport(element)

  if (!viewport) return false

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  const range = document.createRange()
  let current: Node | null

  while ((current = walker.nextNode())) {
    if (!current.textContent?.trim()) continue

    range.selectNodeContents(current)

    if (
      [...range.getClientRects()].some(
        (rect) =>
          rect.width > 0 &&
          rect.height > 0 &&
          rect.bottom > viewport.top &&
          rect.top < viewport.bottom &&
          rect.right > viewport.left &&
          rect.left < viewport.right,
      )
    )
      return true
  }

  return false
}

function clippedTextRange(
  text: Text,
  selection: Range,
  viewport: DOMRect,
): Range | null {
  let start = text === selection.startContainer ? selection.startOffset : 0
  let end = text === selection.endContainer ? selection.endOffset : text.length
  const range = document.createRange()

  if (start >= end) return null

  range.setStart(text, start)
  range.setEnd(text, end)

  const rects = [...range.getClientRects()]

  if (
    !rects.some(
      (rect) =>
        rect.bottom > viewport.top &&
        rect.top < viewport.bottom &&
        rect.right > viewport.left &&
        rect.left < viewport.right,
    )
  )
    return null

  // 分页副本保留完整 DOM，通过裁剪只展示当前页；选区不得读到裁剪外文字。
  let low = start
  let high = end

  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    const character = document.createRange()

    character.setStart(text, middle)
    character.setEnd(text, Math.min(middle + 1, end))

    if (character.getBoundingClientRect().bottom <= viewport.top)
      low = middle + 1
    else high = middle
  }

  start = low
  low = start
  high = end

  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    const character = document.createRange()

    character.setStart(text, middle)
    character.setEnd(text, Math.min(middle + 1, end))

    if (character.getBoundingClientRect().top < viewport.bottom)
      low = middle + 1
    else high = middle
  }

  end = low

  if (start >= end) return null

  range.setStart(text, start)
  range.setEnd(text, end)

  return range
}

export function resolveCanvasSelection(
  root: HTMLElement,
  selection: Range,
  model: CommentAnchorDocumentResult,
): { anchors: CommentAnchor[]; rect: DOMRect } | null {
  if (
    selection.collapsed ||
    !root.contains(selection.startContainer) ||
    !root.contains(selection.endContainer)
  )
    return null

  const found: CommentAnchor[] = []
  let lastRect: DOMRect | null = null

  for (const element of root.querySelectorAll<HTMLElement>(
    '[data-comment-node-key]',
  )) {
    if (
      element.closest(COMMENT_MEASUREMENT_SOURCE_SELECTOR) ||
      element.closest(COMMENT_HIDDEN_PAGE_SELECTOR) ||
      !selection.intersectsNode(element)
    )
      continue

    const viewport = visibleCanvasViewport(element)

    if (!viewport) continue

    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    let current: Node | null
    let first: Range | null = null
    let last: Range | null = null

    while ((current = walker.nextNode())) {
      if (!selection.intersectsNode(current)) continue

      const clipped = clippedTextRange(current as Text, selection, viewport)

      if (!clipped) continue

      first ??= clipped
      last = clipped
    }

    if (!first || !last) continue

    const range = first.cloneRange()

    range.setEnd(last.endContainer, last.endOffset)

    const result = resolveCommentSelection(range, {
      documentHash: model.documentHash,
    })

    if (!result) continue

    found.push(result.anchor)
    lastRect = last.getBoundingClientRect()
  }

  const merged: CommentAnchor[] = []

  for (const anchor of found) {
    const previous = merged.find(
      (item) =>
        item.nodeKey === anchor.nodeKey &&
        item.startGraphemeOffset <= anchor.endGraphemeOffset &&
        item.endGraphemeOffset >= anchor.startGraphemeOffset,
    )

    if (!previous) {
      merged.push({ ...anchor })
      continue
    }

    const node = model.document.nodes.find(
      (item) => item.nodeKey === anchor.nodeKey,
    )!

    previous.startGraphemeOffset = Math.min(
      previous.startGraphemeOffset,
      anchor.startGraphemeOffset,
    )
    previous.endGraphemeOffset = Math.max(
      previous.endGraphemeOffset,
      anchor.endGraphemeOffset,
    )
    previous.exactQuote = graphemeSlice(
      node.text,
      previous.startGraphemeOffset,
      previous.endGraphemeOffset,
    )
    previous.prefix = graphemeSlice(
      node.text,
      Math.max(0, previous.startGraphemeOffset - 32),
      previous.startGraphemeOffset,
    )
    previous.suffix = graphemeSlice(
      node.text,
      previous.endGraphemeOffset,
      previous.endGraphemeOffset + 32,
    )
  }

  return merged.length && lastRect ? { anchors: merged, rect: lastRect } : null
}
