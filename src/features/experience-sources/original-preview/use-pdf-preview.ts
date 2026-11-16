import { useEffect, useMemo, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { experienceError } from '../utils'
import { loadPdfEngine } from './pdf-engine'
import {
  cachePdfFirstPage,
  copyPdfCanvas,
  getPdfFirstPage,
} from './pdf-page-cache'

export function usePdfPreview(blob: Blob) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  const [width, setWidth] = useState(0)
  const pixelRatio = Math.min(2, window.devicePixelRatio || 1)

  const cached = useMemo(
    () => getPdfFirstPage(blob, width, pixelRatio),
    [blob, width, pixelRatio],
  )

  const needsDocument = width > 0 && !(pageNumber === 1 && cached)

  useEffect(() => {
    const container = containerRef.current!
    const measure = () => setWidth(container.clientWidth)
    const observer = new ResizeObserver(measure)

    measure()
    observer.observe(container)

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    setPageNumber(1)
  }, [blob])

  useEffect(() => {
    if (!needsDocument) return

    let active = true
    let dispose: (() => void) | undefined

    setDocument(null)
    setError(null)
    setLoading(true)

    async function open() {
      const [[pdfjs, { default: workerUrl }], data] = await Promise.all([
        loadPdfEngine(),
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
  }, [blob, attempt, needsDocument])

  useEffect(() => {
    const container = containerRef.current

    if (!container || !width) return
    if (pageNumber === 1 && cached) {
      container.replaceChildren(copyPdfCanvas(cached.canvas))
      setLoading(false)
      setError(null)

      return
    }
    if (!document) return

    let active = true
    let cancel: (() => void) | undefined

    setLoading(true)
    setError(null)

    async function render() {
      const page = await document!.getPage(pageNumber)

      if (!active || !container) return

      const viewport = page.getViewport({ scale: 1 })

      const rendered = page.getViewport({
        scale: (Math.min(width, viewport.width) / viewport.width) * pixelRatio,
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

      if (!active) return

      if (pageNumber === 1)
        cachePdfFirstPage(blob, {
          canvas,
          availableWidth: width,
          pixelRatio,
          pageCount: document!.numPages,
        })

      container.replaceChildren(canvas)
      setLoading(false)
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
  }, [blob, document, pageNumber, cached, width, pixelRatio])

  return {
    containerRef,
    pageNumber,
    setPageNumber,
    pageCount: cached?.pageCount ?? document?.numPages,
    loading,
    error,
    retry: () => setAttempt((value) => value + 1),
  }
}
