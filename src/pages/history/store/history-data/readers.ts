import {
  getResumeHistoryResume,
  listResumeHistoryVersions,
} from '@/lib/supabase/resume/history/queries'
import {
  buildCurrentResume,
  normalizeHistoryVersionListItem,
} from '../../utils'
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
  set({ currentResumeLoading: true, currentResumeError: null })

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
      currentResumeError:
        error instanceof Error ? error.message : '当前简历加载失败',
    })

    return false
  }
}

export const readVersions = async (
  runtime: HistoryRuntime,
  set: Set,
  get: Get,
  resumeId: string,
  generation: number,
) => {
  set({ versionsLoading: true, versionsError: null })

  try {
    const versions = await listResumeHistoryVersions(resumeId)

    if (!isCurrent(runtime, get, generation, resumeId)) return false

    set({
      versions: versions.map(normalizeHistoryVersionListItem),
      snapshotCache: Object.fromEntries(
        Object.entries(get().snapshotCache).filter(([id]) =>
          versions.some((version) => version.id === Number(id)),
        ),
      ),
      versionsLoaded: true,
      versionsLoading: false,
    })

    return true
  } catch (error) {
    if (!isCurrent(runtime, get, generation, resumeId)) return false

    set({
      versionsLoading: false,
      versionsError:
        error instanceof Error ? error.message : '版本记录加载失败',
    })

    return false
  }
}

export const hydrate = async (
  runtime: HistoryRuntime,
  set: Set,
  get: Get,
  resumeId: string,
  generation: number,
) => {
  const results = await Promise.all([
    readCurrentResume(runtime, set, get, resumeId, generation),
    readVersions(runtime, set, get, resumeId, generation),
  ])

  return results.every(Boolean)
}
