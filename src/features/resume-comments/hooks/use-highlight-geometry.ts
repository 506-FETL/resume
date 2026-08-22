import type { RefObject } from 'react'
import type { CommentPageRect } from '../anchors/geometry.ts'
import type { ResumeCommentThread } from '../types.ts'
import { useCallback, useEffect, useState } from 'react'
import { commentDomGraphemeOffsetToPoint, findCommentDomBlockAtOffset, findCommentDomBlockByOrdinal, projectCommentDomNode } from '../anchors/dom-projection.ts'
import { rangeToVisiblePageRects } from '../anchors/geometry.ts'
import { graphemeSlice } from '../anchors/graphemes.ts'
import { COMMENT_HIDDEN_PAGE_SELECTOR, COMMENT_MEASUREMENT_SOURCE_SELECTOR } from '../const.ts'

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

function anchorToRange(node: HTMLElement, thread: ResumeCommentThread) {
  const projection = projectCommentDomNode(node)
  const ordinalStartBlock = findCommentDomBlockByOrdinal(projection, thread.anchor.blockOrdinal)
  const startBlock = ordinalStartBlock
    && thread.anchor.startGraphemeOffset >= ordinalStartBlock.startGraphemeOffset
    && thread.anchor.startGraphemeOffset <= ordinalStartBlock.endGraphemeOffset
    ? ordinalStartBlock
    : findCommentDomBlockAtOffset(projection, thread.anchor.startGraphemeOffset)
  const endBlock = findCommentDomBlockAtOffset(projection, thread.anchor.endGraphemeOffset)
  if (!startBlock || !endBlock)
    return null
  if (
    graphemeSlice(
      projection.text,
      thread.anchor.startGraphemeOffset,
      thread.anchor.endGraphemeOffset,
    ) !== thread.anchor.exactQuote
  ) {
    return null
  }
  const localStart = thread.anchor.startGraphemeOffset - startBlock.startGraphemeOffset
  const localEnd = thread.anchor.endGraphemeOffset - endBlock.startGraphemeOffset
  if (
    localStart < 0
    || localEnd < 0
    || thread.anchor.endGraphemeOffset <= thread.anchor.startGraphemeOffset
    || (startBlock.element === endBlock.element && localEnd <= localStart)
  ) {
    return null
  }
  const start = commentDomGraphemeOffsetToPoint(startBlock.element, localStart, 'start')
  const end = commentDomGraphemeOffsetToPoint(endBlock.element, localEnd, 'end')
  if (!start || !end)
    return null
  const range = node.ownerDocument.createRange()
  range.setStart(start.container, start.offset)
  range.setEnd(end.container, end.offset)
  return range.collapsed ? null : range
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
      if (thread.localOnly || thread.resolvedAt || thread.anchorStatus === 'detached')
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
