import type { SupabaseUser } from '@/store/user'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useCollaborationStore } from '@/lib/collaboration'
import { isOfflineResumeId } from '@/lib/offline-resume-manager'
import { subscribeToResumeConfigUpdates } from '@/lib/supabase/resume/config'
import useResumeConfigStore from '@/store/resume/config'
import useResumeStore from '@/store/resume/form'
import { getErrorMessage } from '@/utils'

export function useResumeLoaderCleanup() {
  // 先发起服务端 leave/revoke，再销毁本地文档，避免卸载时留下幽灵成员。
  useEffect(() => {
    return () => {
      useResumeConfigStore.getState().discardSpacingPreview()

      useCollaborationStore
        .getState()
        .stopSharing({
          silent: true,
          bestEffort: true,
        })
        .catch(() => undefined)

      useResumeStore.getState().cleanup()
    }
  }, [])
}

export function useResumeDeletion(
  activeResumeId: string | undefined,
  currentUser: SupabaseUser,
) {
  const navigate = useNavigate()

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
          if (cancelled) return
          if (payload.eventType !== 'DELETE') return

          const deletedResumeId = payload.old.resume_id

          if (deletedResumeId !== activeResumeId) return

          const resumeName = payload.old.display_name || '简历'

          toast.error(`简历 "${resumeName}" 已在其他窗口被删除`, {
            duration: 5000,
          })

          navigate('/resume')
        })
      } catch (error: unknown) {
        toast.error(`监听简历更新失败, ${getErrorMessage(error, '未知错误')}`)
      }
    }

    return () => {
      cancelled = true
      unSubscribe?.()
    }
  }, [activeResumeId, currentUser, navigate])
}
