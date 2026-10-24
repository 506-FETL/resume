import { useCallback } from 'react'
import { isOfflineResumeId } from '@/lib/offline-resume-manager'
import useCurrentResumeStore from '@/store/resume/current'
import { useHistoryResumeOptions } from './use-history-options'

export function useActiveHistoryResumeId() {
  const currentResumeId = useCurrentResumeStore((state) => state.resumeId)

  const setCurrentResume = useCurrentResumeStore(
    (state) => state.setCurrentResume,
  )

  const { resumeOptions, loading, error, reload } = useHistoryResumeOptions()

  const currentResume =
    currentResumeId && !isOfflineResumeId(currentResumeId)
      ? resumeOptions.find((option) => option.resumeId === currentResumeId)
      : undefined

  const activeResumeId = currentResume?.resumeId ?? null

  const selectResume = useCallback(
    (resumeId: string) => {
      const option = resumeOptions.find(
        (option) => option.resumeId === resumeId,
      )

      if (!option || isOfflineResumeId(option.resumeId)) return

      setCurrentResume(option.resumeId, option.type)
    },
    [resumeOptions, setCurrentResume],
  )

  return { activeResumeId, resumeOptions, loading, error, reload, selectResume }
}
