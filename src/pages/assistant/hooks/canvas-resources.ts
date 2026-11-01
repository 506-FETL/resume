import type { ResumeSnapshot } from '@/lib/supabase/resume/history'
import { create } from 'zustand'
import {
  getAccessibleResumeById,
  listAccessibleResumes,
} from '@/lib/resume-access'
import { subscribeResumeReadChanges } from '@/lib/resume-read-events'
import { listAssistantJobOverviews } from '@/lib/supabase/resume/company'
import { buildResumeSnapshot } from '@/pages/history/utils'
import useTrackerStore from '@/pages/tracker/store'
import useUserStore from '@/store/user'

export const useCanvasResources = create(() => ({
  generation: 0,
  resumeRevision: 0,
  boardRevision: 0,
}))

let owner = useUserStore.getState().currentUser?.id ?? null

let optionsPending:
  | Promise<Awaited<ReturnType<typeof listAccessibleResumes>>>
  | undefined

let optionsEpoch = 0
let boardEpoch = 0
let boardData: Awaited<ReturnType<typeof listAssistantJobOverviews>> | undefined

let boardPending:
  | Promise<Awaited<ReturnType<typeof listAssistantJobOverviews>>>
  | undefined

const snapshots = new Map<string, ResumeSnapshot>()
const snapshotPending = new Map<string, Promise<ResumeSnapshot>>()
const snapshotRevisions = new Map<string, number>()

export function invalidateCanvasSnapshot(resumeId?: string) {
  if (resumeId) {
    snapshotRevisions.set(resumeId, (snapshotRevisions.get(resumeId) ?? 0) + 1)

    for (const key of snapshots.keys()) {
      if (key.startsWith(`${resumeId}:`)) snapshots.delete(key)
    }

    for (const key of snapshotPending.keys()) {
      if (key.startsWith(`${resumeId}:`)) snapshotPending.delete(key)
    }
  } else {
    snapshots.clear()
    snapshotPending.clear()
    snapshotRevisions.clear()
  }

  optionsEpoch += 1
  optionsPending = undefined

  useCanvasResources.setState((state) => ({
    resumeRevision: state.resumeRevision + 1,
  }))
}

export function invalidateCanvasBoard() {
  boardEpoch += 1
  boardData = undefined
  boardPending = undefined

  useCanvasResources.setState((state) => ({
    boardRevision: state.boardRevision + 1,
  }))
}

useUserStore.subscribe((state) => {
  const nextOwner = state.currentUser?.id ?? null

  if (nextOwner === owner) return

  owner = nextOwner
  invalidateCanvasSnapshot()
  invalidateCanvasBoard()
  useCanvasResources.setState((state) => ({ generation: state.generation + 1 }))
})

subscribeResumeReadChanges(invalidateCanvasSnapshot)

useTrackerStore.subscribe((state, previous) => {
  if (state.jobs !== previous.jobs) invalidateCanvasBoard()
})

// 轻列表在重新展开时检查 updated_at；全文只在版本改变时重取。
export function loadCanvasOptions() {
  if (optionsPending) return optionsPending

  const epoch = optionsEpoch

  const request = listAccessibleResumes().finally(() => {
    if (epoch === optionsEpoch && optionsPending === request)
      optionsPending = undefined
  })

  optionsPending = request

  return request
}

export function loadCanvasSnapshot(resumeId: string, updatedAt?: string) {
  const state = useCanvasResources.getState()
  const revision = snapshotRevisions.get(resumeId) ?? 0
  const key = `${resumeId}:${updatedAt ?? ''}:${revision}`
  const cached = snapshots.get(key)

  if (cached) return Promise.resolve(cached)

  const pending = snapshotPending.get(key)

  if (pending) return pending

  const request = getAccessibleResumeById(resumeId)
    .then((data) => {
      const snapshot = buildResumeSnapshot(data)

      if (
        state.generation === useCanvasResources.getState().generation &&
        revision === (snapshotRevisions.get(resumeId) ?? 0) &&
        snapshotPending.get(key) === request
      ) {
        snapshots.set(key, snapshot)

        if (snapshots.size > 12)
          snapshots.delete(snapshots.keys().next().value!)
      }

      return snapshot
    })
    .finally(() => {
      if (snapshotPending.get(key) === request) snapshotPending.delete(key)
    })

  snapshotPending.set(key, request)

  return request
}

export function loadCanvasBoard() {
  if (boardData) return Promise.resolve(boardData)
  if (boardPending) return boardPending

  const epoch = boardEpoch
  const generation = useCanvasResources.getState().generation

  const request = listAssistantJobOverviews()
    .then((data) => {
      if (
        epoch === boardEpoch &&
        generation === useCanvasResources.getState().generation
      )
        boardData = data

      return data
    })
    .finally(() => {
      if (boardPending === request) boardPending = undefined
    })

  boardPending = request

  return request
}
