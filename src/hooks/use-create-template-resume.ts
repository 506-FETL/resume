import type { CreateTemplateResumeInput } from '@/lib/resume-template/create/types'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import useResumeListStore from '@/pages/resume/store'
import { useResumeCreationStore } from '@/store/resume-creation'
import useCurrentResumeStore from '@/store/resume/current'

export function useCreateTemplateResume() {
  const navigate = useNavigate()
  const status = useResumeCreationStore((state) => state.status)
  const error = useResumeCreationStore((state) => state.error)
  const createResume = async (
    input: CreateTemplateResumeInput,
    onCreated?: () => void,
  ) => {
    try {
      const result = await useResumeCreationStore.getState().start(input)
      useResumeListStore.getState().addResume({
        resume_id: result.resumeId,
        display_name: result.displayName,
        description: result.description,
        type: result.type,
        created_at: result.createdAt,
        updated_at: result.updatedAt,
        isOffline: result.mode === 'local',
        templateBinding: result.templateBinding,
      })
      useCurrentResumeStore
        .getState()
        .setCurrentResume(result.resumeId, result.type)
      toast.success(result.mode === 'local' ? '本地简历已创建' : '简历已创建')
      navigate('/resume/editor')
      onCreated?.()
      return true
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : '创建失败，请重试')
      return false
    }
  }
  return {
    createResume,
    loading: status === 'preparing' || status === 'saving',
    error,
    retrying: status === 'error' || status === 'uncertain',
  }
}
