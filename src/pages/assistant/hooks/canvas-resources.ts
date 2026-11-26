import { invalidateCanvasResumes } from './canvas-resume'
import { create } from 'zustand'
import { subscribeResumeReadChanges } from '@/lib/resume-read-events'
import { listAssistantJobOverviews } from '@/lib/supabase/resume/company'
import useTrackerStore from '@/pages/tracker/store'
import useUserStore from '@/store/user'

export const useCanvasResources = create(() => ({
  generation: 0,
  resumeRevision: 0,
  boardRevision: 0,
}))

let owner = useUserStore.getState().currentUser?.id ?? null

const BOARD_PAGE_SIZE = 20

type BoardPage = {
  rows: Awaited<ReturnType<typeof listAssistantJobOverviews>>
  hasMore: boolean
}

const boardPages = new Map<number, { data: BoardPage; expires: number }>()
const boardPending = new Map<number, Promise<BoardPage>>()

export function invalidateCanvasSnapshot(resumeId?: string) {
  invalidateCanvasResumes(resumeId)

  useCanvasResources.setState((state) => ({
    resumeRevision: state.resumeRevision + 1,
  }))
}

export function invalidateCanvasBoard() {
  boardPages.clear()
  boardPending.clear()

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

export function loadCanvasBoard(page: number) {
  const cached = boardPages.get(page)

  if (cached && cached.expires > Date.now()) return Promise.resolve(cached.data)

  const pending = boardPending.get(page)

  if (pending) return pending

  const request = listAssistantJobOverviews(
    BOARD_PAGE_SIZE + 1,
    page * BOARD_PAGE_SIZE,
  )
    .then((rows) => {
      const data = {
        rows: rows.slice(0, BOARD_PAGE_SIZE),
        hasMore: rows.length > BOARD_PAGE_SIZE,
      }

      if (boardPending.get(page) === request)
        boardPages.set(page, { data, expires: Date.now() + 30_000 })

      return data
    })
    .finally(() => {
      if (boardPending.get(page) === request) boardPending.delete(page)
    })

  boardPending.set(page, request)

  return request
}
