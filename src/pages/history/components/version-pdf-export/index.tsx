import type { ResumeDocumentState } from '@/components/resume/pagination/types'
import type { ResumeSnapshot } from '@/lib/supabase/resume/history'
import { FileDown, LoaderCircle } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import CanonicalPagedDocument from '@/components/resume/pagination/canonical-paged-document'
import { useResumePrint } from '@/components/resume/pagination/use-resume-print'
import { buildTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import { ResumeTemplateRuntime } from '@/components/resume/runtime/ResumeTemplateRuntime'
import { Button } from '@/components/ui/button'
import { useResolvedResumeTemplate } from '@/hooks/use-resolved-resume-template'
import { DEFAULT_RESUME_FONT_FAMILY_NAME } from '@/lib/schema'
import { cn } from '@/lib/utils'
import useHistoryStore from '../../store'

interface VersionPdfExportButtonProps {
  versionId: number
  /** 导出文件名（浏览器打印标题），如版本名 */
  documentTitle: string
  className?: string
}

/**
 * 导出单个历史版本为 PDF：点击时按需加载该版本快照，渲染进「离屏、未缩放」的 A4 打印节点，
 * 再用 react-to-print 打印（浏览器原生「另存为 PDF」）。appearance 取版本自身快照，
 * 保证导出的是该版本当时的样子，而非当前编辑内容。
 */
export default function VersionPdfExportButton({ versionId, documentTitle, className }: VersionPdfExportButtonProps) {
  const loadVersionSnapshot = useHistoryStore(state => state.loadVersionSnapshot)
  const projectionReferenceDate = useHistoryStore(state => state.versions.find(version => version.id === versionId)?.projection_reference_date)
    ?? new Date().toISOString().slice(0, 10)
  const reduceMotion = useReducedMotion()
  const printRef = useRef<HTMLDivElement>(null)
  // 仅点击导出后挂载打印文档；命中快照缓存不代表需要提前渲染、测量 PDF。
  const [snapshot, setSnapshot] = useState<ResumeSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const shouldPrintRef = useRef(false)
  const [documentState, setDocumentState] = useState<ResumeDocumentState>({
    status: 'measuring',
    signature: null,
    fontFamily: DEFAULT_RESUME_FONT_FAMILY_NAME,
    fontWeights: [400, 600, 700],
    error: null,
  })

  const previewData = useMemo(() => (snapshot ? buildTemplateResumeData(snapshot) : null), [snapshot])
  const { resource, retry } = useResolvedResumeTemplate({ binding: previewData?.templateBinding, enabled: Boolean(snapshot) })
  const definition = resource.status === 'ready' ? resource.data : null
  useEffect(() => {
    if (resource.status === 'error') {
      shouldPrintRef.current = false
      toast.error(resource.error.message)
    }
  }, [resource])

  const handlePrint = useResumePrint({
    contentRef: printRef,
    documentState,
    documentTitle: documentTitle ? `${documentTitle}-简历` : '简历',
  })

  // 快照与 definition 就绪、且用户点击过导出后，触发打印
  useEffect(() => {
    if (
      shouldPrintRef.current
      && snapshot
      && previewData
      && definition
      && documentState.status === 'ready'
    ) {
      shouldPrintRef.current = false
      handlePrint().catch(() => undefined)
    }
  }, [
    documentState.status,
    handlePrint,
    definition,
    previewData,
    snapshot,
  ])

  const handleExport = async () => {
    if (snapshot && previewData && definition) {
      if (documentState.status !== 'measuring')
        await handlePrint()
      else
        shouldPrintRef.current = true
      return
    }

    shouldPrintRef.current = true
    if (snapshot) {
      await retry?.()
      return
    }

    setLoading(true)
    const snap = await loadVersionSnapshot(versionId).finally(() => setLoading(false))
    if (!snap)
      return
    shouldPrintRef.current = true
    setSnapshot(snap)
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={className}
        disabled={loading}
        onClick={handleExport}
      >
        {loading ? <LoaderCircle className={cn(!reduceMotion && 'animate-spin')} data-icon="inline-start" /> : <FileDown data-icon="inline-start" />}
        {loading ? '加载中…' : documentState.status === 'measuring' && snapshot ? '准备中…' : '导出 PDF'}
      </Button>

      {snapshot && previewData && definition && (
        <div
          aria-hidden
          className="pointer-events-none fixed top-0 opacity-0"
          style={{ left: '-100000px' }}
        >
          <CanonicalPagedDocument
            appearance={snapshot}
            contentVersion={JSON.stringify([snapshot, definition, projectionReferenceDate])}
            documentRef={printRef}
            onStateChange={setDocumentState}
          >
            <ResumeTemplateRuntime
              data={previewData}
              definition={definition}
              appearance={snapshot}
              projectionReferenceDate={projectionReferenceDate}
            />
          </CanonicalPagedDocument>
        </div>
      )}
    </>
  )
}
