import type { GenerateVariantArgs } from './types'
import { useCallback } from 'react'
import useJdVariantStore, { makeIdleTask } from '@/store/jd-variant'

export function useJdVariantGenerator(parentResumeId: string) {
  const task = useJdVariantStore(s => s.tasks[parentResumeId])
  const startGenerate = useJdVariantStore(s => s.startGenerate)
  const abortTask = useJdVariantStore(s => s.abortTask)
  const discardTask = useJdVariantStore(s => s.discardTask)
  const clearTask = useJdVariantStore(s => s.clearTask)

  const state = task ?? makeIdleTask(parentResumeId)

  const generate = useCallback((args: GenerateVariantArgs) => startGenerate(args), [startGenerate])
  const abort = useCallback(() => abortTask(parentResumeId), [abortTask, parentResumeId])
  const discardDraft = useCallback(() => discardTask(parentResumeId), [discardTask, parentResumeId])
  const reset = useCallback(() => clearTask(parentResumeId), [clearTask, parentResumeId])

  return { state, generate, abort, reset, discardDraft }
}
