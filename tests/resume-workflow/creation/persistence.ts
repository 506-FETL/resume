import type { PreparedResumeCreation } from '@/lib/resume-template/create/types'
import { browserResumePersistence } from '@/lib/resume-template/create/browser-persistence'

export const savedSnapshots: PreparedResumeCreation[] = []

export let insertCalls = 0

let unknownNext = false
let failLookup = false

const originalFind = browserResumePersistence.find.bind(
  browserResumePersistence,
)

const originalInsert = browserResumePersistence.insert.bind(
  browserResumePersistence,
)

export function simulateUnknownResult() {
  unknownNext = true
}

export function installPersistenceProbe() {
  browserResumePersistence.find = async (prepared) => {
    if (failLookup) {
      failLookup = false

      throw new Error('隔离样本：暂时无法确认写入结果')
    }

    return originalFind(prepared)
  }

  browserResumePersistence.insert = async (prepared) => {
    insertCalls += 1

    const result = await originalInsert(prepared)

    savedSnapshots.push(structuredClone(prepared))

    if (unknownNext) {
      unknownNext = false
      failLookup = true

      throw new Error('隔离样本：写入已完成，但响应丢失')
    }

    return result
  }
}
