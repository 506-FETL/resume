import type { RefObject } from 'react'
import type { ResumeDocumentState } from './types'
import { useCallback } from 'react'
import { useReactToPrint } from 'react-to-print'
import { toast } from 'sonner'
import { RESUME_PRINT_PAGE_STYLE } from './const'
import {
  layoutSignaturesEqual,
  measurePaginationSnapshot,
  waitForResumeFont,
} from './utils'

function getPrintElements(printDocument: Document) {
  const firstPage = printDocument.querySelector<HTMLElement>('[data-resume-page]')
  const viewport = printDocument.querySelector<HTMLElement>('[data-resume-page-viewport]')
  const source = printDocument.querySelector<HTMLElement>('[data-resume-page-content]')
  if (!firstPage || !viewport || !source)
    throw new Error('打印文档结构不完整')
  return { firstPage, viewport, source }
}

export function useResumePrint({
  contentRef,
  documentState,
  documentTitle,
}: {
  contentRef: RefObject<HTMLDivElement | null>
  documentState: ResumeDocumentState
  documentTitle: string
}) {
  const handlePrint = useReactToPrint({
    contentRef,
    documentTitle,
    pageStyle: RESUME_PRINT_PAGE_STYLE,
    print: async (iframe) => {
      if (!documentState.signature)
        throw new Error('简历分页尚未准备完成')

      const printDocument = iframe.contentDocument
      const printWindow = iframe.contentWindow
      if (!printDocument || !printWindow)
        throw new Error('当前浏览器无法创建打印窗口')
      if (typeof printWindow.print !== 'function')
        throw new TypeError('当前浏览器不支持 PDF 导出，请使用 Safari 或 Chrome')

      await waitForResumeFont(
        printDocument,
        documentState.fontFamily,
        documentState.fontWeights,
      )

      const { firstPage, viewport, source } = getPrintElements(printDocument)
      const clone = measurePaginationSnapshot({
        page: firstPage,
        viewport,
        source,
        fontFamily: printWindow.getComputedStyle(source).fontFamily,
      })
      if (!layoutSignaturesEqual(documentState.signature, clone.signature))
        throw new Error('打印布局尚未稳定，请重试')

      printWindow.focus()
      printWindow.print()
    },
    onPrintError: (_location, error) => {
      toast.error(error.message || 'PDF 导出失败')
    },
  })

  return useCallback(async () => {
    if (documentState.status === 'measuring') {
      toast.info('简历分页准备中')
      return false
    }
    if (documentState.status === 'error') {
      toast.error(documentState.error || '简历分页失败')
      return false
    }
    await handlePrint()
    return true
  }, [documentState, handlePrint])
}
