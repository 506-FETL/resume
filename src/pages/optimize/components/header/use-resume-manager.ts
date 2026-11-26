import { Cloud, FileCheck, FileText, HardDrive } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import useUserStore from '@/store/user'
import useAtsStore from '../../store'
import type { ResumeSource } from '../../store/picker-queries'

export function useResumeManager() {
  const selectedResumeId = useAtsStore((s) => s.selectedResumeId)
  const selectedType = useAtsStore((s) => s.selectedResumeType)
  const selectedOption = useAtsStore((s) => s.selectedResumeOption)

  const scored = useAtsStore((s) =>
    Boolean(
      s.currentAtsConfig && s.currentAtsConfig.resume_id === s.selectedResumeId,
    ),
  )

  const selectedRevision = useAtsStore((s) => s.selectedResumeRevision)
  const revision = useAtsStore((s) => s.resumeOptionsRevision)
  const pages = useAtsStore((s) => s.resumePages)
  const loadPage = useAtsStore((s) => s.loadResumePage)
  const loadSelected = useAtsStore((s) => s.loadSelectedResumeOption)
  const startVisit = useAtsStore((s) => s.startResumeOptionVisit)

  const userId = useUserStore((s) => s.currentUser?.id ?? null)
  const authReady = useUserStore((s) => s.authStatus !== 'unknown')
  const [open, setOpen] = useState(false)
  const previousRevisionRef = useRef(selectedRevision)

  useEffect(() => {
    startVisit()
  }, [startVisit, userId])

  useEffect(() => {
    if (!open || !authReady) return

    loadPage('online', userId)
    loadPage('offline', userId)
  }, [open, authReady, userId, loadPage, revision])

  useEffect(() => {
    if (previousRevisionRef.current === selectedRevision) return

    previousRevisionRef.current = selectedRevision

    if (authReady && selectedResumeId && selectedType)
      loadSelected(selectedResumeId, selectedType, userId)
  }, [
    authReady,
    selectedResumeId,
    selectedType,
    selectedRevision,
    userId,
    loadSelected,
  ])

  const ButtonIcon = !selectedResumeId
    ? FileText
    : scored
      ? FileCheck
      : selectedType === 'offline'
        ? HardDrive
        : Cloud

  const iconColorClass = !selectedResumeId
    ? 'text-muted-foreground'
    : scored
      ? 'text-green-600'
      : selectedType === 'offline'
        ? 'text-amber-600'
        : 'text-blue-600'

  const selectedName =
    selectedOption?.resume_id === selectedResumeId
      ? selectedOption?.display_name || '未命名简历'
      : selectedResumeId
        ? '已选择简历'
        : '选择简历'

  const handleSelect = (id: string, source: ResumeSource) => {
    useAtsStore.getState().setSelectedResume(id, source)
    setOpen(false)
  }

  return {
    pages,
    authReady,
    loadMore: (source: ResumeSource) => loadPage(source, userId, true),
    open,
    setOpen,
    userId,
    selectedResumeName: selectedName,
    selectedResumeId,
    ButtonIcon,
    iconColorClass,
    handleSelect,
  }
}
