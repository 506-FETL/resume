import type { FormDataMap } from './const'
import useResumeStore from './form'

// AI/画布写入：把某模块写入路由到编辑器 Automerge 文档（未加载则先 loadResumeData），并立即同步，确保 automerge_documents 与 resume_config 一起更新
export async function applyResumeFieldToDocument(
  resumeId: string,
  sectionKey: keyof FormDataMap,
  value: Record<string, unknown>,
): Promise<void> {
  if (useResumeStore.getState().currentResumeId !== resumeId)
    await useResumeStore.getState().loadResumeData(resumeId)
  useResumeStore.getState().updateForm(sectionKey, value as never)
  await useResumeStore.getState().manualSync()
}
