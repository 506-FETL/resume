import type { PersistedResumeSnapshot } from '@/lib/schema'
import useUserStore from '@/store/user'

interface CreatedResumeInitialization {
  ownerId: string
  resumeId: string
  updatedAt: string
  snapshot: Partial<PersistedResumeSnapshot>
}

let accountVersion = 0
let createdResume: CreatedResumeInitialization | undefined

useUserStore.subscribe((current, previous) => {
  if (current.currentUser?.id === previous.currentUser?.id) return

  accountVersion += 1
  createdResume = undefined
})

export function getCreationAccountVersion() {
  return accountVersion
}

export function rememberCreatedResumeInitialization(
  initialization: CreatedResumeInitialization,
  expectedAccountVersion: number,
) {
  if (
    accountVersion !== expectedAccountVersion ||
    useUserStore.getState().currentUser?.id !== initialization.ownerId
  )
    return

  createdResume = initialization
}

export function takeCreatedResumeInitialization(
  resumeId: string,
  ownerId: string,
) {
  const initialization = createdResume

  // 只交接一次创建结果；初始化失败、切换目标或重新打开均走正常云端读取。
  createdResume = undefined

  if (
    initialization?.resumeId !== resumeId ||
    initialization.ownerId !== ownerId
  )
    return undefined

  return initialization
}
