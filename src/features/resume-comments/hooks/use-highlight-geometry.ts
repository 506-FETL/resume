import type { RefObject } from 'react'
import type { CommentPageRect } from '../anchors/geometry.ts'
import type { ResumeCommentThread } from '../types.ts'
import { useCallback, useEffect, useState } from 'react'
import { rangeToVisiblePageRects } from '../anchors/geometry.ts'
import {
  countCommentGraphemes,
  graphemeOffsetToTextPoint,
  normalizeCommentText,
} from '../anchors/graphemes.ts'
import {
  COMMENT_HIDDEN_PAGE_SELECTOR,
  COMMENT_MEASUREMENT_SOURCE_SELECTOR,
} from '../const.ts'

export interface CommentThreadGeometry {
  threadId: string
  rects: CommentPageRect[]
}

function findVisibleNodes(root: HTMLElement, nodeKey: string) {
  return Array.from(root.querySelectorAll<HTMLElement>('[data-comment-node-key]'))
    .filter(element => (
      element.dataset.commentNodeKey === nodeKey
      && !element.closest(COMMENT_MEASUREMENT_SOURCE_SELECTOR)
      && !element.closest(COMMENT_HIDDEN_PAGE_SELECTOR)
    ))
}

function findBlock(node: HTMLElement, ordinal: number) {
  return [
    ...(node.matches('[data-comment-block-ordinal]') ? [node] : []),
    ...Array.from(node.querySelectorAll<HTMLElement>('[data-comment-block-ordinal]')),
  ].find(element => (
    element.closest('[data-comment-node-key]') === node
    && Number(element.dataset.commentBlockOrdinal) === ordinal
  )) ?? null
}

function getBlockStart(node: HTMLElement, ordinal: number) {
  const blocks = [
    ...(node.matches('[data-comment-block-ordinal]') ? [node] : []),
    ...Array.from(node.querySelectorAll<HTMLElement>('[data-comment-block-ordinal]')),
  ]
    .filter(element => element.closest('[data-comment-node-key]') === node)
    .map(element => ({
      element,
      ordinal: Number(element.dataset.commentBlockOrdinal),
    }))
    .filter(item => Number.isInteger(item.ordinal) && item.ordinal >= 0)
    .sort((left, right) => left.ordinal - right.ordinal)
  let offset = 0
  for (const [index, item] of blocks.entries()) {
    if (index > 0)
      offset += 1
    if (item.ordinal === ordinal)
      return offset
    offset += countCommentGraphemes(normalizeCommentText(item.element.textContent ?? ''))
  }
  return null
}

function collectTextNodes(block: HTMLElement) {
  const nodes: Text[] = []
  const walker = block.ownerDocument.createTreeWalker(block, NodeFilter.SHOW_TEXT)
  let current = walker.nextNode()
  while (current) {
    if ((current.parentElement?.closest('[data-comment-block-ordinal]') ?? null) === block)
      nodes.push(current as Text)
    current = walker.nextNode()
  }
  return nodes
}

function anchorToRange(node: HTMLElement, thread: ResumeCommentThread) {
  const block = findBlock(node, thread.anchor.blockOrdinal)
  const blockStart = getBlockStart(node, thread.anchor.blockOrdinal)
  if (!block || blockStart === null)
    return null
  const textNodes = collectTextNodes(block)
  if (textNodes.length === 0)
    return null
  const localStart = thread.anchor.startGraphemeOffset - blockStart
  const localEnd = thread.anchor.endGraphemeOffset - blockStart
  if (localStart < 0 || localEnd <= localStart)
    return null
  const start = graphemeOffsetToTextPoint(textNodes, localStart)
  const end = graphemeOffsetToTextPoint(textNodes, localEnd)
  const range = block.ownerDocument.createRange()
  range.setStart(start.textNode, start.utf16Offset)
  range.setEnd(end.textNode, end.utf16Offset)
  return normalizeCommentText(range.toString()) === thread.anchor.exactQuote ? range : null
}

export function useHighlightGeometry({
  rootRef,
  threads,
  enabled,
  layoutRevision,
}: {
  rootRef: RefObject<HTMLElement | null>
  threads: ResumeCommentThread[]
  enabled: boolean
  layoutRevision?: string | number
}) {
  const [geometry, setGeometry] = useState<CommentThreadGeometry[]>([])

  const recompute = useCallback(() => {
    const root = rootRef.current
    if (!enabled || !root) {
      setGeometry([])
      return
    }
    setGeometry(threads.flatMap((thread) => {
      if (thread.resolvedAt || thread.anchorStatus === 'detached')
        return []
      const rects = findVisibleNodes(root, thread.anchor.nodeKey).flatMap((node) => {
        const range = anchorToRange(node, thread)
        return range ? rangeToVisiblePageRects(range) : []
      })
      return rects.length > 0 ? [{ threadId: thread.id, rects }] : []
    }))
  }, [enabled, rootRef, threads])

  useEffect(() => {
    const root = rootRef.current
    if (!enabled || !root)
      return
    let frame = 0
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(recompute)
    }
    const observer = new ResizeObserver(schedule)
    observer.observe(root)
    root.querySelectorAll<HTMLElement>('[data-resume-page-index]').forEach(page => observer.observe(page))
    window.addEventListener('resize', schedule)
    window.addEventListener('resume:pagination-complete', schedule)
    document.fonts?.ready.then(schedule).catch(() => undefined)
    schedule()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', schedule)
      window.removeEventListener('resume:pagination-complete', schedule)
    }
  }, [enabled, layoutRevision, recompute, rootRef])

  return { geometry, recompute }
}
