import { isResumeNotFoundError } from '@/lib/resume-id'
import { getResumeHistoryResume } from '@/lib/supabase/resume/history/queries/resumes'
import { buildCurrentResume } from '../../utils/versions'
import type { Get, HistoryRuntime, Set } from './types'

export const isCurrent = (
  runtime: HistoryRuntime,
  get: Get,
  generation: number,
  resumeId: string | null,
) => generation === runtime.requestId && get().resumeId === resumeId

export const readCurrentResume = async (
  runtime: HistoryRuntime,
  set: Set,
  get: Get,
  resumeId: string,
  generation: number,
) => {
  set({
    currentResumeLoading: true,
    currentResumeError: null,
    currentResumeMissing: false,
  })

  try {
    const resume = await getResumeHistoryResume(resumeId)
    const currentResume = await buildCurrentResume(resume)

    if (!isCurrent(runtime, get, generation, resumeId)) return false

    set({ currentResume, currentResumeLoading: false })

    return true
  } catch (error) {
    if (!isCurrent(runtime, get, generation, resumeId)) return false

    set({
      currentResumeLoading: false,
      ...(isResumeNotFoundError(error) && {
        currentResume: null,
        currentResumeMissing: true,
      }),
      currentResumeError:
        error instanceof Error ? error.message : '当前简历加载失败',
    })

    return false
  }
}
