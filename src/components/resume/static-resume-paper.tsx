import type { RefObject } from 'react'
import { useLayoutEffect, useRef } from 'react'

export default function StaticResumePaper({
  paper,
  documentRef,
}: {
  paper: { width: number; height: number; pages: HTMLElement }
  documentRef?: RefObject<HTMLDivElement | null>
}) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const outer = viewportRef.current!
    const inner = canvasRef.current!

    const pages = paper.pages.cloneNode(true) as HTMLDivElement

    inner.replaceChildren(pages)

    if (documentRef) documentRef.current = pages

    function scale(width: number) {
      const ratio = Math.min(1, width / paper.width)

      inner.style.transform = `scale(${ratio})`
      outer.style.height = `${paper.height * ratio}px`
    }

    scale(outer.clientWidth)

    const observer = new ResizeObserver(([entry]) =>
      scale(entry.contentRect.width),
    )

    observer.observe(outer)

    return () => {
      observer.disconnect()

      if (documentRef) documentRef.current = null
    }
  }, [documentRef, paper])

  return (
    <div
      ref={viewportRef}
      className='relative mx-auto w-full'
      style={{ maxWidth: paper.width }}
    >
      <div
        ref={canvasRef}
        className='origin-top-left'
        style={{ width: paper.width }}
      />
    </div>
  )
}
