import type { RefObject } from 'react'
import type { ResumeDocumentState } from '@/components/resume/pagination/types'
import { saveAs } from 'file-saver'
import { toast } from 'sonner'
import { create } from 'zustand'
import { DEFAULT_RESUME_FONT_FAMILY_NAME, getFontFamilyCSS, themeColorMap } from '@/lib/schema'
import useResumeConfigStore from './config'
import useResumeStore from './form'
import { createResumeDocHtml } from './helpers'

interface ResumeExportState {
  sourceRef: RefObject<HTMLDivElement | null> | null
  handlePrint: (() => Promise<boolean>) | null
  documentState: ResumeDocumentState
  setSourceRef: (ref: RefObject<HTMLDivElement | null>) => void
  setHandlePrint: (handlePrint: (() => Promise<boolean>) | null) => void
  setDocumentState: (state: ResumeDocumentState) => void
  exportToPdf: () => Promise<void>
  exportToDoc: () => void
}

const useResumeExportStore = create<ResumeExportState>((set, get) => ({
  sourceRef: null,
  handlePrint: null,
  documentState: {
    status: 'measuring',
    signature: null,
    fontFamily: DEFAULT_RESUME_FONT_FAMILY_NAME,
    fontWeights: [400, 600, 700],
    error: null,
  },

  setSourceRef: (ref) => {
    set({ sourceRef: ref })
  },

  setHandlePrint: (handlePrint) => {
    set({ handlePrint })
  },

  setDocumentState: (documentState) => {
    set({ documentState })
  },

  exportToPdf: async () => {
    const { documentState, handlePrint } = get()

    if (documentState.status !== 'ready' || !handlePrint) {
      toast.warning(documentState.error || '简历分页准备中')
      return
    }

    try {
      await handlePrint()
    }
    catch (error) {
      toast.error(`导出 PDF 失败,请稍后重试${error instanceof Error ? `: ${error.message}` : ''}`)
    }
  },

  exportToDoc: () => {
    const { sourceRef } = get()
    const resumeName = useResumeStore.getState().basics.name

    if (!sourceRef?.current) {
      toast.warning('简历加载中')
      return
    }

    try {
      const spacingConfig = useResumeConfigStore.getState().spacing
      const fontConfig = useResumeConfigStore.getState().font
      const themeConfig = useResumeConfigStore.getState().theme
      const resumeTheme = themeColorMap[themeConfig.theme]
      const fontSize = fontConfig.fontSize

      const contentHtml = sourceRef.current.innerHTML
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/\s*on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')

      const html = createResumeDocHtml(contentHtml, {
        baseFontSize: fontSize,
        fontFamily: getFontFamilyCSS(fontConfig.fontFamily),
        lineHeight: spacingConfig.lineHeight,
        pageMargin: spacingConfig.pageMargin,
        badgeBackground: resumeTheme.badgeBg,
        textPrimary: resumeTheme.textPrimary,
      })

      const blob = new Blob([html], {
        type: 'application/msword',
      })

      saveAs(blob, resumeName ? `${resumeName}-简历.doc` : '我的简历.doc')
      toast.success('导出成功!')
    }
    catch (error) {
      toast.error(`导出 Word 失败,请稍后重试${error instanceof Error ? `: ${error.message}` : ''}`)
    }
  },
}))

export default useResumeExportStore
