import type { JdVariantStore } from './types'
import { create } from 'zustand'
import { createAbortTask, createClearTask, createDiscardTask, createStartGenerate } from './generate'

const useJdVariantStore = create<JdVariantStore>()((set, get) => ({
  tasks: {},
  startGenerate: createStartGenerate(set, get),
  abortTask: createAbortTask(set, get),
  discardTask: createDiscardTask(set, get),
  clearTask: createClearTask(set, get),
}))

export default useJdVariantStore
export type { JdVariantStore, VariantTask } from './types'
export { makeIdleTask } from './types'
