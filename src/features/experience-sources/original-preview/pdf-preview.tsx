import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION, EASE } from '@/lib/motion'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { experienceError } from '../utils'

export default function PdfPreview({ blob }: { blob: Blob }) {
  const reduced = useReducedMotion()
  const containerRef = useRef<HTMLDivElement>(null)
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    let dispose: (() => void) | undefined

    setDocument(null)
    setPageNumber(1)
    setError(null)
    setLoading(true)

    async function open() {
      const [pdfjs, { default: workerUrl }, data] = await Promise.all([
        import('pdfjs-dist'),
        import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
        blob.arrayBuffer(),
      ])

      if (!active) return

      const port = new Worker(workerUrl, { type: 'module' })
      const worker = pdfjs.PDFWorker.create({ port })
      const task = pdfjs.getDocument({ data, worker, useSystemFonts: true })

      dispose = () => {
        task.destroy().catch(() => {})
        port.terminate()
      }

      const next = await task.promise

      if (active) setDocument(next)
    }

    open().catch((cause) => {
      if (active) {
        setError(experienceError(cause))
        setLoading(false)
      }
    })

    return () => {
      active = false
      dispose?.()
    }
  }, [blob, attempt])

  useEffect(() => {
    const container = containerRef.current

    if (!document || !container) return

    let active = true
    let cancel: (() => void) | undefined

    setLoading(true)
    setError(null)

    async function render() {
      const page = await document!.getPage(pageNumber)

      if (!active || !container) return

      const viewport = page.getViewport({ scale: 1 })
      const scale = Math.min(2, window.devicePixelRatio || 1)
      const width = Math.min(container.clientWidth, viewport.width)

      const rendered = page.getViewport({
        scale: (width / viewport.width) * scale,
      })

      const canvas = window.document.createElement('canvas')
      const context = canvas.getContext('2d')!

      canvas.width = Math.ceil(rendered.width)
      canvas.height = Math.ceil(rendered.height)
      canvas.style.width = '100%'
      canvas.style.height = 'auto'
      canvas.setAttribute('role', 'img')
      canvas.setAttribute('aria-label', `原件第 ${pageNumber} 页`)

      const task = page.render({
        canvas,
        canvasContext: context,
        viewport: rendered,
      })

      cancel = () => task.cancel()
      await task.promise
      page.cleanup()

      if (active) {
        container.replaceChildren(canvas)
        setLoading(false)
      }
    }

    render().catch((cause) => {
      if (active) {
        setError(experienceError(cause))
        setLoading(false)
      }
    })

    return () => {
      active = false
      cancel?.()
    }
  }, [document, pageNumber])

  return (
    <div className='space-y-3'>
      <div
        className='flex items-center justify-between gap-2'
        aria-label='PDF 翻页'
      >
        <Button
          variant='outline'
          size='sm'
          disabled={loading || pageNumber === 1}
          onClick={() => setPageNumber((number) => number - 1)}
        >
          上一页
        </Button>
        <p
          className='flex items-center gap-2 text-xs text-muted-foreground'
          aria-live='polite'
        >
          {loading && <Spinner className='size-3' />}
          {document
            ? `第 ${pageNumber} / ${document.numPages} 页`
            : '正在打开 PDF'}
        </p>
        <Button
          variant='outline'
          size='sm'
          disabled={loading || !document || pageNumber >= document.numPages}
          onClick={() => setPageNumber((number) => number + 1)}
        >
          下一页
        </Button>
      </div>
      {!document && !error && (
        <Skeleton
          className='aspect-[210/297] w-full'
          aria-label='正在打开 PDF 原件'
        />
      )}
      <motion.div
        ref={containerRef}
        className='min-h-0 overflow-hidden rounded-md'
        animate={{ opacity: loading ? 0.65 : 1 }}
        transition={{ duration: reduced ? 0 : DURATION.fast, ease: EASE.out }}
        aria-busy={loading}
      />
      {error && (
        <div role='alert' className='space-y-2 text-sm'>
          <p className='text-destructive'>{error}</p>
          <Button
            variant='outline'
            onClick={() => setAttempt((value) => value + 1)}
          >
            重新打开 PDF
          </Button>
        </div>
      )}
      <p className='text-xs text-muted-foreground'>
        需要复制文字时，可打开下方提取文字。
      </p>
    </div>
  )
}
