import { useLayoutEffect, useRef } from 'react'
import { PaperSkeleton } from '@/components/loading-skeleton'
import {
  useMatchingPreviewPaper,
  type PreviewPaper,
} from '../../store/preview-paper'

export default function CachedPreview({ paper }: { paper: PreviewPaper }) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const outer = viewportRef.current!
    const inner = canvasRef.current!

    inner.replaceChildren(paper.pages.cloneNode(true))

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

    return () => observer.disconnect()
  }, [paper])

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

export function PreviewBackground({ contentKey }: { contentKey: string }) {
  const paper = useMatchingPreviewPaper(contentKey)

  return paper ? (
    <CachedPreview paper={paper} />
  ) : (
    <PaperSkeleton label='正在加载模板预览' />
  )
}
