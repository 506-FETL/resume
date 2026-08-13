import type { RefObject } from 'react'
import type { CommentThreadGeometry } from '../hooks/use-highlight-geometry.ts'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

function rectanglesOverlap(
  left: { x: number, y: number, width: number, height: number },
  right: { x: number, y: number, width: number, height: number },
) {
  return left.x < right.x + right.width
    && right.x < left.x + left.width
    && left.y < right.y + right.height
    && right.y < left.y + left.height
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
  const root = rootRef.current
  if (!root || hidden)
    return null
  const pages = new Map(Array.from(root.querySelectorAll<HTMLElement>('[data-resume-page-index]')).map(page => [
    Number(page.dataset.resumePageIndex),
    page,
  ]))

  return Array.from(pages).flatMap(([pageIndex, page]) => {
    const overlayRoot = page.querySelector<HTMLElement>('[data-comment-overlay-root]')
    if (!overlayRoot)
      return []
    const pageGeometry = geometry.flatMap(item => item.rects
      .filter(rect => rect.pageIndex === pageIndex)
      .map(rect => ({ ...rect, threadId: item.threadId })))
    if (pageGeometry.length === 0)
      return []

    const visuals = createPortal(
      <>
        {pageGeometry.map(rect => (
          <span
            key={`${rect.threadId}-${rect.x}-${rect.y}-${rect.width}-${rect.height}`}
            className={cn(
              'absolute rounded-[2px] bg-amber-300/25 mix-blend-multiply transition-[background-color,box-shadow] duration-150',
              (rect.threadId === activeThreadId || rect.threadId === hoveredThreadId)
              && 'bg-amber-400/65 ring-1 ring-amber-500/70',
            )}
            style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
          />
        ))}
      </>,
      overlayRoot,
    )
    const hits = createPortal(
      <div data-resume-comment-ui className="pointer-events-none absolute inset-0 z-20">
        {pageGeometry.map(rect => (
          <button
            key={`${rect.threadId}-${rect.x}-${rect.y}-${rect.width}-${rect.height}`}
            type="button"
            aria-label="查看此处评论"
            className="pointer-events-auto absolute cursor-pointer rounded-[2px] bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
            onClick={(event) => {
              const ids = Array.from(new Set(pageGeometry
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
