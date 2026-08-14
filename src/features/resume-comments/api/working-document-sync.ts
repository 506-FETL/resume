import type { PersistedResumeSnapshot } from '@/lib/schema'

export type WorkingDocumentSyncListener = (
  snapshot: PersistedResumeSnapshot,
) => Promise<void>

interface WorkingDocumentSyncState {
  listener: WorkingDocumentSyncListener
  current: Promise<void>
  lastError: Error | null
}

const states = new Map<string, WorkingDocumentSyncState>()

export function registerWorkingDocumentSync(
  resumeId: string,
  listener: WorkingDocumentSyncListener,
) {
  const state: WorkingDocumentSyncState = {
    listener,
    current: Promise.resolve(),
    lastError: null,
  }
  states.set(resumeId, state)
  return () => {
    if (states.get(resumeId) === state)
      states.delete(resumeId)
  }
}

/** 简历保存已成功；评论同步失败只记入评论通道，不反向把简历保存标成失败。 */
export async function notifyWorkingDocumentPersisted(
  resumeId: string,
  snapshot: PersistedResumeSnapshot,
) {
  const state = states.get(resumeId)
  if (!state)
    return
  state.current = state.current
    .catch(() => undefined)
    .then(() => state.listener(snapshot))
    .then(() => {
      state.lastError = null
    })
    .catch((error: unknown) => {
      state.lastError = error instanceof Error ? error : new Error('评论文档同步失败')
    })
  await state.current
}

export async function assertWorkingDocumentCommentsReady(resumeId: string) {
  const state = states.get(resumeId)
  if (!state)
    throw new Error('评论文档尚未初始化，请稍后重试')
  await state.current
  if (state.lastError)
    throw state.lastError
}
