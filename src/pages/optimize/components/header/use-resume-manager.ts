import { Cloud, FileCheck, FileText, HardDrive } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useUserStore from '@/store/user'
import useAtsStore from '../../store'

export interface ResumeConfig {
  id: string
  resume_id: string
  display_name: string
  isScored: boolean | null
  overall_score: number | null
  created_at: string
  isOffline?: boolean
}

interface UseResumeManagerReturn {
  resumes: ResumeConfig[]
  loading: boolean
  loadError: string | null
  retry: () => Promise<void>
  open: boolean
  setOpen: (open: boolean) => void
  selectedResumeName: string
  selectedResumeId: string | null
  onlineResumes: ResumeConfig[]
  offlineResumes: ResumeConfig[]
  ButtonIcon: any
  iconColorClass: string
  handleSelect: (resume: ResumeConfig) => void
}

export function useResumeManager(): UseResumeManagerReturn {
  const atsConfigs = useAtsStore((s) => s.atsConfigs)
  const currentAtsConfig = useAtsStore((s) => s.currentAtsConfig)
  const selectedResumeId = useAtsStore((s) => s.selectedResumeId)
  const selectedType = useAtsStore((s) => s.selectedResumeType)
  const selectedOption = useAtsStore((s) => s.selectedResumeOption)
  const loadSelected = useAtsStore((s) => s.loadSelectedResumeOption)
  const reloadSummaries = useAtsStore((s) => s.reloadSummaries)
  const setSelectedResume = useAtsStore((s) => s.setSelectedResume)

  const storedResumes = useAtsStore((s) => s.resumeOptions)
  const listLoading = useAtsStore((s) => s.resumeOptionsLoading)
  const resumeOptionsRevision = useAtsStore((s) => s.resumeOptionsRevision)
  const selectedRevision = useAtsStore((s) => s.selectedResumeRevision)
  const listError = useAtsStore((s) => s.resumeOptionsError)
  const loadResumes = useAtsStore((s) => s.loadResumeOptions)

  const userId = useUserStore((state) => state.currentUser?.id ?? null)
  const authStatus = useUserStore((state) => state.authStatus)
  const accountMatches = authStatus !== 'unknown'
  const loading = !accountMatches || listLoading
  const loadError = accountMatches ? listError : null
  const [open, setOpen] = useState(false)

  const scoresOwnerRef = useRef<string | null>(null)

  useEffect(() => {
    scoresOwnerRef.current = null
  }, [userId])

  useEffect(() => {
    if (!open || !accountMatches) return

    loadResumes(userId, scoresOwnerRef.current !== userId)

    if (userId && scoresOwnerRef.current !== userId) {
      scoresOwnerRef.current = userId
      reloadSummaries()
    }
  }, [
    open,
    accountMatches,
    userId,
    loadResumes,
    reloadSummaries,
    resumeOptionsRevision,
  ])

  useEffect(() => {
    if (accountMatches && selectedResumeId && selectedType)
      loadSelected(selectedResumeId, selectedType === 'offline')
  }, [
    accountMatches,
    selectedResumeId,
    selectedType,
    loadSelected,
    selectedRevision,
  ])

  const resumes = useMemo<ResumeConfig[]>(() => {
    if (!accountMatches) return []

    const latestByResume = new Map(
      atsConfigs?.map((report) => [report.resume_id, report]),
    )

    return storedResumes.map((resume) => {
      const resumeAts = latestByResume.get(resume.resume_id)

      return {
        id: resume.resume_id,
        resume_id: resume.resume_id,
        display_name: resume.display_name || '未命名简历',
        created_at: resume.created_at,
        isOffline: resume.isOffline,
        isScored: atsConfigs === null ? null : Boolean(resumeAts),
        overall_score: resumeAts?.overall_score ?? null,
      }
    })
  }, [accountMatches, storedResumes, atsConfigs])

  const handleSelect = useCallback(
    (resume: ResumeConfig) => {
      setSelectedResume(
        resume.resume_id,
        resume.isOffline ? 'offline' : 'online',
      )

      setOpen(false)
    },
    [setSelectedResume],
  )

  const onlineResumes = resumes.filter((r) => !r.isOffline)
  const offlineResumes = resumes.filter((r) => r.isOffline)

  const scored =
    currentAtsConfig !== null && currentAtsConfig.resume_id === selectedResumeId

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

  return {
    resumes,
    loading,
    loadError,
    retry: () => loadResumes(userId),
    open,
    setOpen,
    selectedResumeName: selectedName,
    selectedResumeId,
    onlineResumes,
    offlineResumes,
    ButtonIcon,
    iconColorClass,
    handleSelect,
  }
}
