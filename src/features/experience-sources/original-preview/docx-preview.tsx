import { useEffect, useRef, useState } from 'react'
import { renderAsync } from 'docx-preview'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION, EASE } from '@/lib/motion'
import { PreviewError } from './preview-error'

const FRAME_DOCUMENT = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; font-src data: blob:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><style>body{margin:0} .docx-wrapper{padding:16px!important;background:transparent!important;display:block!important} .docx-wrapper>section.docx{margin:0 auto!important;box-shadow:none!important} section.docx[hidden]{display:none!important}</style></head><body></body></html>`

export default function DocxPreview({
  blob,
  name,
}: {
  blob: Blob
  name: string
}) {
  const [frame, setFrame] = useState<HTMLIFrameElement | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [pages, setPages] = useState<HTMLElement[]>([])
  const [page, setPage] = useState(0)
  const [zoom, setZoom] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    const doc = frame?.contentDocument

    if (!doc) return

    let active = true
    const content = doc.createElement('div')
    const styles = doc.createElement('div')

    doc.body.replaceChildren(styles, content)
    setLoaded(false)
    setError(null)
    setPages([])
    setPage(0)

    renderAsync(blob, content, styles, {
      useBase64URL: true,
      renderAltChunks: false,
      ignoreLastRenderedPageBreak: false,
    })
      .then(() => {
        if (!active) return

        const next = Array.from(
          content.querySelectorAll<HTMLElement>('section.docx'),
        )

        if (!next.length) throw new Error('DOCX 中没有可预览的页面。')

        // 文档链接保留文字，隔离预览中不导航到外部页面。
        content
          .querySelectorAll('a')
          .forEach((link) => link.removeAttribute('href'))

        setPages(next)
        setLoaded(true)
      })
      .catch(() => {
        if (active) setError('DOCX 预览失败，请重试或下载原件查看。')
      })

    return () => {
      active = false
    }
  }, [blob, frame, attempt])

  useEffect(() => {
    const container = containerRef.current
    const current = pages[page]

    if (!frame || !container || !current) return

    pages.forEach((item, index) => {
      item.hidden = index !== page
    })

    const resize = () => {
      current.style.zoom = '1'

      const width = current.getBoundingClientRect().width
      const scale = zoom ?? Math.min(1, (container.clientWidth - 32) / width)

      current.style.zoom = String(scale)
      frame.style.height = `${Math.ceil(current.getBoundingClientRect().height + 32)}px`
    }

    const observer = new ResizeObserver(resize)

    observer.observe(container)
    observer.observe(current)
    resize()

    return () => observer.disconnect()
  }, [frame, pages, page, zoom])

  useEffect(() => {
    const current = pages[page]

    if (!current) return

    const animation = current.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: reduced ? 0 : DURATION.fast * 1000,
      easing: `cubic-bezier(${EASE.out.join(',')})`,
    })

    return () => animation.cancel()
  }, [pages, page, reduced])

  return (
    <div ref={containerRef} className='min-w-0 space-y-3'>
      <div className='flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground'>
        <span>DOCX 原件预览</span>
        {loaded && (
          <div className='flex items-center gap-2'>
            <Button
              variant='ghost'
              size='icon-sm'
              aria-label='上一页文档'
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft />
            </Button>
            <span aria-live='polite'>
              {page + 1} / {pages.length}
            </span>
            <Button
              variant='ghost'
              size='icon-sm'
              aria-label='下一页文档'
              disabled={page === pages.length - 1}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight />
            </Button>
          </div>
        )}
      </div>
      {loaded && (
        <div className='flex items-center gap-1'>
          <Button
            variant='ghost'
            size='icon-sm'
            aria-label='缩小文档'
            disabled={zoom === null}
            onClick={() => setZoom(zoom! <= 1 ? null : zoom! - 0.5)}
          >
            <ZoomOut />
          </Button>
          <Button variant='ghost' size='sm' onClick={() => setZoom(null)}>
            {zoom === null ? '适应宽度' : `${zoom * 100}%`}
          </Button>
          <Button
            variant='ghost'
            size='icon-sm'
            aria-label='放大文档'
            disabled={zoom !== null && zoom >= 2}
            onClick={() => setZoom(zoom === null ? 1 : zoom + 0.5)}
          >
            <ZoomIn />
          </Button>
        </div>
      )}
      {error && (
        <PreviewError message={error} onRetry={() => setAttempt(attempt + 1)} />
      )}
      {!loaded && !error && (
        <Skeleton
          className='aspect-[210/297] w-full'
          aria-label='正在排版 DOCX'
        />
      )}
      <iframe
        title={`${name} 原件预览`}
        sandbox='allow-same-origin'
        srcDoc={FRAME_DOCUMENT}
        onLoad={(event) => setFrame(event.currentTarget)}
        className='w-full rounded-lg border bg-white'
        style={{
          display: error ? 'none' : 'block',
          height: loaded ? undefined : 0,
          visibility: loaded ? 'visible' : 'hidden',
          opacity: loaded ? 1 : 0,
          transition: reduced
            ? 'none'
            : `opacity ${DURATION.base}s cubic-bezier(${EASE.out.join(',')})`,
        }}
      />
    </div>
  )
}
