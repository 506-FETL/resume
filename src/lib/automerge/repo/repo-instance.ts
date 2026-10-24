import type { RepoConfig } from '@automerge/automerge-repo'
import { Repo } from '@automerge/automerge-repo'
import { IndexedDBStorageAdapter } from '@automerge/automerge-repo-storage-indexeddb'
import { AUTOMERGE_STORAGE_KEY } from '../shared'

let repoInstance: Repo | null = null
let activeResumeId: string | null = null

function createAutomergeRepo(): Repo {
  const storage = new IndexedDBStorageAdapter(AUTOMERGE_STORAGE_KEY)

  const config: RepoConfig = {
    storage,
    sharePolicy: async () => true,
  }

  return new Repo(config)
}

/**
 * 当前编辑器一次只维护一份在线简历；切换简历时重建 repo，避免上一个会话的网络适配器残留。
 */
export function getAutomergeRepo(resumeId?: string): Repo {
  if (
    repoInstance &&
    resumeId &&
    activeResumeId &&
    activeResumeId !== resumeId
  ) {
    destroyAutomergeRepo()
  }

  if (!repoInstance) {
    repoInstance = createAutomergeRepo()
  }

  if (resumeId) {
    activeResumeId = resumeId
  }

  return repoInstance
}

export function destroyAutomergeRepo() {
  if (!repoInstance) {
    return
  }

  try {
    repoInstance.networkSubsystem.disconnect()
  } catch {
    // 忽略断开过程中的网络错误
  }

  repoInstance = null
  activeResumeId = null
}
