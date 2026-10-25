import { Cloud, FileCheck, FileText, HardDrive } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import useResumeListStore from '@/pages/resume/store'
import useUserStore from '@/store/user'
import useAtsStore from '../../store'

export interface ResumeConfig {
  id: string
  resume_id: string
  display_name: string
  isScored: boolean
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
  currentResume: ResumeConfig | undefined
  ButtonIcon: any
  iconColorClass: string
  handleSelect: (resume: ResumeConfig) => void
}

export function useResumeManager(): UseResumeManagerReturn {
  const { atsConfigs, currentAtsConfig, selectedResumeId, setSelectedResume } =
    useAtsStore()

  const {
    resumes: storedResumes,
    accountId,
    loading: listLoading,
    loadError: listError,
    loadResumes,
    cancelLoad,
  } = useResumeListStore()

  const userId = useUserStore((state) => state.currentUser?.id ?? null)
  const authStatus = useUserStore((state) => state.authStatus)
  const accountMatches = authStatus !== 'unknown' && accountId === userId
  const loading = !accountMatches || listLoading
  const loadError = accountMatches ? listError : null
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (authStatus === 'unknown') return

    loadResumes()

    return cancelLoad
  }, [authStatus, userId, loadResumes, cancelLoad])

  const resumes = useMemo<ResumeConfig[]>(() => {
    if (!accountMatches) return []

    return storedResumes.map((resume) => {
      const resumeAts = atsConfigs?.find(
        (ats) => ats.resume_id === resume.resume_id,
      )

      return {
        id: resume.resume_id,
        resume_id: resume.resume_id,
        display_name: resume.display_name || '未命名简历',
        created_at: resume.created_at,
        isOffline: resume.isOffline,
        isScored: Boolean(resumeAts),
        overall_score: resumeAts?.summary.overall_score ?? null,
      }
    })
  }, [accountMatches, storedResumes, atsConfigs])

  useEffect(() => {
    if (currentAtsConfig && !selectedResumeId && resumes.length > 0) {
      const found = resumes.find(
        (r) => r.resume_id === currentAtsConfig.resume_id,
      )

      if (found)
        setSelectedResume(
          found.resume_id,
          found.isOffline ? 'offline' : 'online',
        )
    }
  }, [currentAtsConfig, resumes, selectedResumeId, setSelectedResume])

  const selectedResumeName =
    resumes.find((r) => r.resume_id === selectedResumeId)?.display_name ||
    '选择简历'

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

  const currentResume = useMemo(
    () => resumes.find((r) => r.resume_id === selectedResumeId),
    [resumes, selectedResumeId],
  )

  const ButtonIcon = useMemo(() => {
    if (!currentResume) return FileText
    if (currentResume.isOffline)
      return currentResume.isScored ? FileCheck : HardDrive

    return currentResume.isScored ? FileCheck : Cloud
  }, [currentResume])

  const iconColorClass = useMemo(() => {
    if (!currentResume) return 'text-muted-foreground'
    if (currentResume.isScored) return 'text-green-600'

    return currentResume.isOffline ? 'text-amber-600' : 'text-blue-600'
  }, [currentResume])

  return {
    resumes,
    loading,
    loadError,
    retry: loadResumes,
    open,
    setOpen,
    selectedResumeName,
    selectedResumeId,
    onlineResumes,
    offlineResumes,
    currentResume,
    ButtonIcon,
    iconColorClass,
    handleSelect,
  }
}
