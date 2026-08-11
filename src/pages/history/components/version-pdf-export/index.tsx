import type { ResumeDocumentState } from '@/components/resume/pagination/types'
import type { TemplateManifest } from '@/lib/resume-template/schema'
import type { ResumeSnapshot } from '@/lib/supabase/resume/history'
import { FileDown, LoaderCircle } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import CanonicalPagedDocument from '@/components/resume/pagination/canonical-paged-document'
import { useResumePrint } from '@/components/resume/pagination/use-resume-print'
import { buildTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import { ResumeTemplateRuntime } from '@/components/resume/runtime/ResumeTemplateRuntime'
import { Button } from '@/components/ui/button'
import { getBuiltInTemplateManifest } from '@/lib/resume-template/runtime/get-built-in-manifest'
import { getManifestFromTemplateBinding } from '@/lib/resume-template/runtime/get-manifest-from-binding'
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
  const { loadVersionSnapshot, snapshotCache } = useHistoryStore()
  const printRef = useRef<HTMLDivElement>(null)
  const [snapshot, setSnapshot] = useState<ResumeSnapshot | null>(() => snapshotCache[versionId] ?? null)
  const [loading, setLoading] = useState(false)
  const shouldPrintRef = useRef(false)
  const [documentState, setDocumentState] = useState<ResumeDocumentState>({
    status: 'measuring',
    signature: null,
    fontFamily: 'Noto Sans SC',
    fontWeights: [400, 600, 700],
    error: null,
  })

  const previewData = useMemo(() => (snapshot ? buildTemplateResumeData(snapshot) : null), [snapshot])
  const [manifest, setManifest] = useState<TemplateManifest | null>(null)

  // 解析模板 manifest（与 ScaledReadonlyPreview 一致：优先 templateBinding，失败回退内置模板）
  useEffect(() => {
    if (!previewData) {
      setManifest(null)
      return
    }
    let cancelled = false
    const fallback = getBuiltInTemplateManifest(previewData.templateBinding?.basedOnResumeType ?? previewData.type)

    if (!previewData.templateBinding) {
      setManifest(fallback)
      return
    }

    getManifestFromTemplateBinding(previewData.templateBinding)
      .then((resolved) => {
        if (!cancelled)
          setManifest(resolved ?? fallback)
      })
      .catch(() => {
        if (!cancelled)
          setManifest(fallback)
      })

    return () => {
      cancelled = true
    }
  }, [previewData])

  const handlePrint = useResumePrint({
    contentRef: printRef,
    documentState,
    documentTitle: documentTitle ? `${documentTitle}-简历` : '简历',
  })

  // 快照与 manifest 就绪、且用户点击过导出后，触发打印
  useEffect(() => {
    if (
      shouldPrintRef.current
      && snapshot
      && previewData
      && manifest
      && documentState.status === 'ready'
    ) {
      shouldPrintRef.current = false
      handlePrint().catch(() => undefined)
    }
  }, [
    documentState.status,
    handlePrint,
    manifest,
    previewData,
    snapshot,
  ])

  const handleExport = async () => {
    if (
      snapshot
      && previewData
      && manifest
      && documentState.status === 'ready'
    ) {
      await handlePrint()
      return
    }

    shouldPrintRef.current = true
    if (snapshot)
      return

    setLoading(true)
    const snap = await loadVersionSnapshot(versionId)
    setLoading(false)
    if (!snap)
      return
    shouldPrintRef.current = true
    setSnapshot(snap)
  }

  return (
    <>
      <Button
        variant="outline"
        className={className}
        disabled={loading}
        onClick={handleExport}
      >
        {loading ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <FileDown data-icon="inline-start" />}
        导出 PDF
      </Button>

      {snapshot && previewData && manifest && (
        <div
          aria-hidden
          className="pointer-events-none fixed top-0 opacity-0"
          style={{ left: '-100000px' }}
        >
          <CanonicalPagedDocument
            appearance={snapshot}
            contentVersion={JSON.stringify([snapshot, manifest])}
            documentRef={printRef}
            onStateChange={setDocumentState}
          >
            <ResumeTemplateRuntime
              data={previewData}
              manifest={manifest}
              appearance={snapshot}
            />
          </CanonicalPagedDocument>
        </div>
      )}
    </>
  )
}
