import type { RefObject } from 'react'
import type { CommentThreadGeometry } from '../hooks/use-highlight-geometry.ts'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { createPortal } from 'react-dom'
import { DURATION, EASE } from '@/lib/motion'
import { cn } from '@/lib/utils'
import {
  mergeHighlightVisualRects,
  rectanglesOverlap,
} from './highlight-rects.ts'

const HIGHLIGHT_STAGGER_SECONDS = 0.06
const HIGHLIGHT_MAX_STAGGER_WINDOW_SECONDS = 0.42
const HIGHLIGHT_HIDDEN_CLIP_PATH = 'inset(0 100% 0 0)'
const HIGHLIGHT_VISIBLE_CLIP_PATH = 'inset(0 0% 0 0)'

interface TimedHighlightRect {
  threadIds: string[]
  pageIndex: number
  x: number
  y: number
  width: number
  height: number
  key: string
  enterDelay: number
  exitDelay: number
}

function flattenHighlightRects(geometry: CommentThreadGeometry[]) {
  return geometry.flatMap(item => item.rects.map((rect, rectIndex) => ({
    ...rect,
    threadId: item.threadId,
    key: `${item.threadId}-${rect.pageIndex}-${rectIndex}`,
  }))).sort((left, right) => (
    left.pageIndex - right.pageIndex
    || left.y - right.y
    || left.x - right.x
  ))
}

function orderHighlightRects(geometry: CommentThreadGeometry[]): TimedHighlightRect[] {
  const ordered = mergeHighlightVisualRects(flattenHighlightRects(geometry))
  const stagger = ordered.length <= 1
    ? 0
    : Math.min(
        HIGHLIGHT_STAGGER_SECONDS,
        HIGHLIGHT_MAX_STAGGER_WINDOW_SECONDS / (ordered.length - 1),
      )

  return ordered.map((rect, orderIndex) => ({
    ...rect,
    enterDelay: orderIndex * stagger,
    exitDelay: (ordered.length - orderIndex - 1) * stagger,
  }))
}

export function HighlightOverlay({
  rootRef,
  geometry,
  activeThreadId,
  hoveredThreadId,
  hidden,
  onPick,
  onHover,
}: {
  rootRef: RefObject<HTMLElement | null>
  geometry: CommentThreadGeometry[]
  activeThreadId: string | null
  hoveredThreadId: string | null
  hidden: boolean
  onPick: (threadIds: string[], point: { x: number, y: number }) => void
  onHover: (threadId: string | null) => void
}) {
  const reduceMotion = useReducedMotion()
  const root = rootRef.current
  if (!root)
    return null
  const pages = new Map(Array.from(root.querySelectorAll<HTMLElement>('[data-resume-page-index]')).map(page => [
    Number(page.dataset.resumePageIndex),
    page,
  ]))
  const orderedGeometry = orderHighlightRects(geometry)
  const hitGeometry = flattenHighlightRects(geometry)

  return Array.from(pages).flatMap(([pageIndex, page]) => {
    const overlayRoot = page.querySelector<HTMLElement>('[data-comment-overlay-root]')
    if (!overlayRoot)
      return []
    const pageGeometry = orderedGeometry.filter(rect => rect.pageIndex === pageIndex)
    const visibleGeometry = hidden ? [] : pageGeometry
    const pageHitGeometry = hitGeometry.filter(rect => rect.pageIndex === pageIndex)
    const visibleHitGeometry = hidden ? [] : pageHitGeometry

    const visuals = createPortal(
      <AnimatePresence>
        {visibleGeometry.map(rect => (
          <motion.span
            key={rect.key}
            initial={reduceMotion ? false : { clipPath: HIGHLIGHT_HIDDEN_CLIP_PATH }}
            animate={{
              clipPath: HIGHLIGHT_VISIBLE_CLIP_PATH,
              transition: {
                delay: reduceMotion ? 0 : rect.enterDelay,
                duration: reduceMotion ? 0 : DURATION.slow,
                ease: EASE.out,
              },
            }}
            exit={{
              clipPath: HIGHLIGHT_HIDDEN_CLIP_PATH,
              transition: {
                delay: reduceMotion ? 0 : rect.exitDelay,
                duration: reduceMotion ? 0 : DURATION.slow,
                ease: EASE.in,
              },
            }}
            className={cn(
              'pointer-events-none absolute rounded-[2px] bg-amber-300/25 mix-blend-multiply transition-[background-color,box-shadow] duration-150 motion-reduce:transition-none',
              (rect.threadIds.includes(activeThreadId ?? '')
                || rect.threadIds.includes(hoveredThreadId ?? ''))
              && 'bg-amber-400/65 ring-1 ring-amber-500/70',
            )}
            style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
          />
        ))}
      </AnimatePresence>,
      overlayRoot,
    )
    const hits = createPortal(
      <div data-resume-comment-ui className="pointer-events-none absolute inset-0 z-20">
        {visibleHitGeometry.map(rect => (
          <button
            key={rect.key}
            type="button"
            aria-label="查看此处评论"
            className="pointer-events-auto absolute cursor-pointer rounded-[2px] bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
            onClick={(event) => {
              const ids = Array.from(new Set(pageHitGeometry
                .filter(candidate => rectanglesOverlap(rect, candidate))
                .map(candidate => candidate.threadId)))
              onPick(ids, { x: event.clientX, y: event.clientY })
            }}
            onPointerEnter={() => onHover(rect.threadId)}
            onPointerLeave={() => onHover(null)}
            onFocus={() => onHover(rect.threadId)}
            onBlur={() => onHover(null)}
          />
        ))}
      </div>,
      page,
    )
    return [visuals, hits]
  })
}
