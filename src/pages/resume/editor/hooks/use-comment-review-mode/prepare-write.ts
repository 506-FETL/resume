import { useCallback } from 'react'
import {
  assertWorkingDocumentCommentsReady,
  notifyWorkingDocumentPersisted,
} from '@/features/resume-comments/api/working-document-sync.ts'
import useResumeStore from '@/store/resume/form'
import { mapSourceToPersistedSnapshot } from '@/store/resume/helpers'

export function usePrepareWorkingCommentWrite(resumeId: string | null) {
  return useCallback(async () => {
    if (!resumeId) throw new Error('离线简历不能评论')

    const before = useResumeStore.getState()

    if (before.mode !== 'online' || before.currentResumeId !== resumeId)
      throw new Error('离线简历不能评论')
    if (before.pendingChanges) {
      await before.manualSync()

      const after = useResumeStore.getState()

      if (after.pendingChanges || after.syncError)
        throw new Error(after.syncError ?? '简历尚未保存，暂时无法创建评论')
    }

    const current = useResumeStore.getState()

    if (current.currentResumeId !== resumeId || current.mode !== 'online')
      throw new Error('简历已切换，请重新打开评论')

    // 编辑器未挂载期间的保存没有监听者；进入页面和提交前都补齐当前正文。
    await notifyWorkingDocumentPersisted(
      resumeId,
      mapSourceToPersistedSnapshot(current),
    )

    await assertWorkingDocumentCommentsReady(resumeId)
  }, [resumeId])
}
