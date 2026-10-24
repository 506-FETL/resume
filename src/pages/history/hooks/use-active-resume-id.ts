import { useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { isOfflineResumeId } from '@/lib/offline-resume-manager'
import useCurrentResumeStore from '@/store/resume/current'
import { useHistoryResumeOptions } from './use-history-options'

export function useActiveHistoryResumeId() {
  const [searchParams, setSearchParams] = useSearchParams()
  const currentResumeId = useCurrentResumeStore((state) => state.resumeId)
  const setCurrentResume = useCurrentResumeStore(
    (state) => state.setCurrentResume,
  )
  const { resumeOptions, loading, error, reload } = useHistoryResumeOptions()

  const queryResumeId = searchParams.get('resumeId')
  const queryResume =
    queryResumeId && !isOfflineResumeId(queryResumeId)
      ? resumeOptions.find((option) => option.resumeId === queryResumeId)
      : undefined
  const currentResume =
    currentResumeId && !isOfflineResumeId(currentResumeId)
      ? resumeOptions.find((option) => option.resumeId === currentResumeId)
      : undefined
  const activeResume = queryResume ?? currentResume
  const activeResumeId = activeResume?.resumeId ?? null
  const validQueryResumeId = queryResume?.resumeId
  const validQueryResumeType = queryResume?.type

  // 显式 URL 选择通过云端列表校验后，同步到应用已有的持久化当前简历。
  useEffect(() => {
    const current = useCurrentResumeStore.getState()
    if (
      !loading &&
      !error &&
      validQueryResumeId &&
      validQueryResumeType &&
      (current.resumeId !== validQueryResumeId ||
        current.resumeType !== validQueryResumeType)
    ) {
      setCurrentResume(validQueryResumeId, validQueryResumeType)
    }
  }, [
    validQueryResumeId,
    validQueryResumeType,
    loading,
    error,
    setCurrentResume,
  ])

  const selectResume = useCallback(
    (resumeId: string) => {
      const option = resumeOptions.find(
        (option) => option.resumeId === resumeId,
      )
      if (!option || isOfflineResumeId(option.resumeId)) return

      setCurrentResume(option.resumeId, option.type)
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous)
        next.set('resumeId', option.resumeId)
        return next
      })
    },
    [resumeOptions, setCurrentResume, setSearchParams],
  )

  return { activeResumeId, resumeOptions, loading, error, reload, selectResume }
}
