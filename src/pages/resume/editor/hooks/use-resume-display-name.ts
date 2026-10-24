import useResumeListStore from '@/pages/resume/store'
import useCurrentResumeStore from '@/store/resume/current'
import useResumeStore from '@/store/resume/form'

export function useResumeDisplayName() {
  const resumeId = useCurrentResumeStore((state) => state.resumeId)

  const listName = useResumeListStore(
    (state) =>
      state.resumes.find((resume) => resume.resume_id === resumeId)
        ?.display_name,
  )

  // 刷新或直接打开编辑器时列表尚未加载，复用文档加载时读取的元信息。
  const documentName = useResumeStore((state) =>
    state.currentResumeId === resumeId ? state.documentDisplayName : null,
  )

  return listName?.trim() || documentName?.trim() || '未命名简历'
}
