import type { SupabaseUser } from '../types'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useCollaborationStore } from '@/lib/collaboration'
import { isOfflineResumeId } from '@/lib/offline-resume-manager'
import { isResumeNotFoundError } from '@/lib/resume-id'
import { DEFAULT_RESUME_APPEARANCE } from '@/lib/schema'
import { subscribeToResumeConfigUpdates } from '@/lib/supabase/resume'
import { getCurrentUser } from '@/lib/supabase/user'
import useResumeConfigStore from '@/store/resume/config'
import useCurrentResumeStore from '@/store/resume/current'
import useResumeStore from '@/store/resume/form'
import useUserStore from '@/store/user'
import { getErrorMessage } from '@/utils'

export function useResumeLoader() {
  const [loading, setLoading] = useState(true)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const { resumeId, setCurrentResume, clearCurrentResume } = useCurrentResumeStore()
  const loadResumeData = useResumeStore(state => state.loadResumeData)
  const currentUser = useUserStore(state => state.currentUser)
  const setCurrentUser = useUserStore(state => state.setCurrentUser)

  const queryResumeId = searchParams.get('resumeId')
  const documentUrlParam = searchParams.get('docUrl')
  const activeResumeId = queryResumeId ?? resumeId ?? undefined

  // 获取当前用户
  useEffect(() => {
    let mounted = true
    getCurrentUser().then((user: SupabaseUser) => {
      if (mounted)
        setCurrentUser(user)
    })

    return () => {
      mounted = false
    }
  }, [setCurrentUser])

  // 清理函数
  useEffect(() => {
    return () => {
      useResumeConfigStore.getState().discardSpacingPreview()
      useResumeStore.getState().cleanup()
      useCollaborationStore.getState().stopSharing({ silent: true })
    }
  }, [])

  // 处理 URL 参数切换简历
  useEffect(() => {
    if (queryResumeId && queryResumeId !== resumeId) {
      setCurrentResume(queryResumeId, 'default')
    }
  }, [resumeId, queryResumeId, setCurrentResume])

  // 加载简历数据
  useEffect(() => {
    useResumeConfigStore.getState().discardSpacingPreview()

    if (!activeResumeId) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    loadResumeData(activeResumeId, {
      documentUrl: documentUrlParam ?? undefined,
    })
      .then(async ({ snapshot, hasPersistedAppearance, cloudAppearanceStatus, mode }) => {
        if (cancelled)
          return

        const configStore = useResumeConfigStore.getState()
        const resumeStore = useResumeStore.getState()

        if (mode !== 'online' || hasPersistedAppearance) {
          configStore.hydrateFromSnapshot(snapshot)
          return
        }

        if (cloudAppearanceStatus === 'error') {
          configStore.hydrateFromSnapshot(snapshot)
          return
        }

        const legacyConfig = configStore.readLegacyLocalConfig()
        const fallbackAppearance = legacyConfig ?? DEFAULT_RESUME_APPEARANCE

        configStore.replaceConfig(fallbackAppearance)
        resumeStore.updateAppearanceConfig(fallbackAppearance)
      })
      .catch((error: unknown) => {
        if (cancelled)
          return
        if (isResumeNotFoundError(error) && useCurrentResumeStore.getState().resumeId === activeResumeId)
          clearCurrentResume()
        toast.error(`加载简历失败, ${getErrorMessage(error, '未知错误')}`)
        navigate('/resume')
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [activeResumeId, clearCurrentResume, documentUrlParam, loadResumeData, navigate])

  // 监听简历删除
  useEffect(() => {
    if (!activeResumeId || isOfflineResumeId(activeResumeId) || !currentUser)
      return

    let unSubscribe: (() => void) | undefined
    let cancelled = false

    subscribeToResumeUpdates()

    async function subscribeToResumeUpdates() {
      try {
        unSubscribe = await subscribeToResumeConfigUpdates((payload) => {
          if (cancelled)
            return
          if (payload.eventType !== 'DELETE')
            return

          const deletedResumeId = payload.old.resume_id
          if (deletedResumeId !== activeResumeId)
            return

          const resumeName = payload.old.display_name || '简历'
          toast.error(`简历 "${resumeName}" 已在其他窗口被删除`, {
            duration: 5000,
          })

          navigate('/resume')
        })
      }
      catch (error: unknown) {
        toast.error(`监听简历更新失败, ${getErrorMessage(error, '未知错误')}`)
      }
    }

    return () => {
      cancelled = true
      unSubscribe?.()
    }
  }, [activeResumeId, currentUser, navigate])

  return {
    loading,
    currentUser,
    activeResumeId,
  }
}
