import type { ResumeDocumentState } from '@/components/resume/pagination/types'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useResumePrint } from '@/components/resume/pagination/use-resume-print'
import { DEFAULT_RESUME_FONT_FAMILY_NAME } from '@/lib/schema'
import { buildResumeShareSnapshotSource } from '@/lib/supabase/resume/share'
import useCurrentResumeStore from '@/store/resume/current'
import useResumeExportStore from '@/store/resume/export'
import useResumeStore from '@/store/resume/form'
import { useResumeDisplayName } from '../../hooks/use-resume-display-name'

export function useWorkspaceDocument() {
  const documentRef = useRef<HTMLDivElement | null>(null)
  const sourceRef = useRef<HTMLDivElement | null>(null)
  const previewScrollRef = useRef<HTMLDivElement | null>(null)

  const [documentState, setDocumentState] = useState<ResumeDocumentState>({
    status: 'measuring',
    signature: null,
    fontFamily: DEFAULT_RESUME_FONT_FAMILY_NAME,
    fontWeights: [400, 600, 700],
    error: null,
  })

  const resumeName = useResumeStore((state) => state.basics.name)
  const currentResumeId = useCurrentResumeStore((state) => state.resumeId)
  const currentDisplayName = useResumeDisplayName()
  const setSourceRef = useResumeExportStore((state) => state.setSourceRef)
  const setHandlePrint = useResumeExportStore((state) => state.setHandlePrint)

  const setExportDocumentState = useResumeExportStore(
    (state) => state.setDocumentState,
  )

  const handlePrint = useResumePrint({
    contentRef: documentRef,
    documentState,
    documentTitle: resumeName ? `${resumeName}-简历` : '我的简历',
  })

  useEffect(() => {
    setSourceRef(sourceRef)
  }, [setSourceRef])

  useEffect(() => {
    setExportDocumentState(documentState)
  }, [documentState, setExportDocumentState])

  useEffect(() => {
    setHandlePrint(handlePrint)

    return () => setHandlePrint(null)
  }, [setHandlePrint, handlePrint])

  const getShareSnapshot = useCallback(async () => {
    const before = useResumeStore.getState()

    if (before.currentResumeId !== currentResumeId || before.mode !== 'online')
      throw new Error('简历已切换，请重新打开分享')
    if (before.pendingChanges || before.isSyncing) await before.manualSync()

    const current = useResumeStore.getState()

    if (
      current.currentResumeId !== currentResumeId ||
      current.mode !== 'online'
    )
      throw new Error('简历已切换，请重新打开分享')
    if (current.pendingChanges || current.syncError)
      throw new Error(current.syncError ?? '简历尚未保存，请保存完成后再分享')

    return buildResumeShareSnapshotSource(
      current.getPersistedSnapshot(),
      currentDisplayName,
    )
  }, [currentResumeId, currentDisplayName])

  return {
    documentRef,
    sourceRef,
    previewScrollRef,
    documentState,
    setDocumentState,
    currentResumeId,
    currentDisplayName,
    getShareSnapshot,
  }
}
